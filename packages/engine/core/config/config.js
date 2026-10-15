/**
 * @license
 * Copyright 2020 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import path from 'path';

import log from '../../logger/index.js';

import * as Engine from '../../types/engine.js';
import {Runner} from '../runner.js';
import defaultConfig from './default-config.js';
import {nonSimulatedSettingsOverrides} from './constants.js';
import {
  throwInvalidDependencyOrder,
  isValidArtifactDependency,
  throwInvalidArtifactDependency,
  assertValidConfig,
} from './validation.js';
import {filterConfigByGatherMode, filterConfigByExplicitFilters} from './filters.js';
import {
  deepCloneConfigJson,
  resolveSettings,
  resolveAuditsToDefns,
  resolveGathererToDefn,
  mergePlugins,
  mergeConfigFragment,
  mergeConfigFragmentArrayByKey,
} from './config-helpers.js';
import {getModuleDirectory} from '../../shared/esm-utils.js';
import * as format from '../../shared/localization/format.js';

const defaultConfigPath = path.join(
  getModuleDirectory(import.meta),
  '../../config/default-config.js'
);

/**
 * Certain gatherers are destructive to the page state.
 * We should ensure that these gatherers run after any custom gatherers.
 * The default priority should be 0.
 * TODO: Make this an official part of the config or design a different solution.
 * @type {Record<string, number|undefined>}
 */
const internalArtifactPriorities = {
  FullPageScreenshot: 1,
  BFCacheFailures: 1,
};

/**
 * @param {Engine.Config|undefined} config
 * @param {{configPath?: string}} context
 * @return {{configWorkingCopy: Engine.Config, configDir?: string, configPath?: string}}
 */
function resolveWorkingCopy(config, context) {
  let {configPath} = context;

  if (configPath && !path.isAbsolute(configPath)) {
    throw new Error('configPath must be an absolute path');
  }

  if (!config) {
    config = defaultConfig;
    configPath = defaultConfigPath;
  }

  // The directory of the config path, if one was provided.
  const configDir = configPath ? path.dirname(configPath) : undefined;

  return {
    configWorkingCopy: deepCloneConfigJson(config),
    configPath,
    configDir,
  };
}

/**
 * @param {Engine.Config} config
 * @return {Engine.Config}
 */
function resolveExtensions(config) {
  if (!config.extends) return config;

  if (config.extends !== 'engine:default') {
    throw new Error('`engine:default` is the only valid extension method.');
  }

  const {artifacts, ...extensionJSON} = config;
  const defaultClone = deepCloneConfigJson(defaultConfig);
  const mergedConfig = mergeConfigFragment(defaultClone, extensionJSON);

  mergedConfig.artifacts = mergeConfigFragmentArrayByKey(
    defaultClone.artifacts,
    artifacts,
    artifact => artifact.id
  );

  return mergedConfig;
}

/**
 * Looks up the required artifact IDs for each dependency, throwing if no earlier artifact satisfies the dependency.
 *
 * @param {Engine.Config.ArtifactJson} artifact
 * @param {Engine.Config.AnyGathererDefn} gatherer
 * @param {Map<Symbol, Engine.Config.AnyArtifactDefn>} artifactDefnsBySymbol
 * @return {Engine.Config.AnyArtifactDefn['dependencies']}
 */
function resolveArtifactDependencies(artifact, gatherer, artifactDefnsBySymbol) {
  if (!('dependencies' in gatherer.instance.meta)) return undefined;

  const dependencies = Object.entries(gatherer.instance.meta.dependencies).map(
      ([dependencyName, artifactSymbol]) => {
        const dependency = artifactDefnsBySymbol.get(artifactSymbol);

        // Check that dependency was defined before us.
        if (!dependency) throwInvalidDependencyOrder(artifact.id, dependencyName);

        // Check that the phase relationship is OK too.
        const validDependency = isValidArtifactDependency(gatherer, dependency.gatherer);
        if (!validDependency) throwInvalidArtifactDependency(artifact.id, dependencyName);

        return [dependencyName, {id: dependency.id}];
      }
  );

  return Object.fromEntries(dependencies);
}

/**
 *
 * @param {Engine.Config.ArtifactJson[]|null|undefined} artifacts
 * @param {string|undefined} configDir
 * @return {Promise<Engine.Config.AnyArtifactDefn[] | null>}
 */
async function resolveArtifactsToDefns(artifacts, configDir) {
  if (!artifacts) return null;

  const status = {msg: 'Resolve artifact definitions', id: 'engine:config:resolveArtifactsToDefns'};
  log.time(status, 'verbose');

  const sortedArtifacts = [...artifacts];
  sortedArtifacts.sort((a, b) => {
    const aPriority = internalArtifactPriorities[a.id] || 0;
    const bPriority = internalArtifactPriorities[b.id] || 0;
    return aPriority - bPriority;
  });

  /** @type {Map<Symbol, Engine.Config.AnyArtifactDefn>} */
  const artifactDefnsBySymbol = new Map();

  const coreGathererList = Runner.getGathererList();
  const artifactDefns = [];
  for (const artifactJson of sortedArtifacts) {
    const gathererJson = artifactJson.gatherer;

    const gatherer = await resolveGathererToDefn(gathererJson, coreGathererList, configDir);

    /** @type {Engine.Config.AnyArtifactDefn} */
    // @ts-expect-error - Typescript can't validate the gatherer and dependencies match
    // even though it knows that they're each valid on their own.
    const artifact = {
      id: artifactJson.id,
      gatherer,
      dependencies: resolveArtifactDependencies(artifactJson, gatherer, artifactDefnsBySymbol),
    };

    const symbol = artifact.gatherer.instance.meta.symbol;
    if (symbol) artifactDefnsBySymbol.set(symbol, artifact);
    artifactDefns.push(artifact);
  }

  log.timeEnd(status);
  return artifactDefns;
}

/**
 * Overrides the settings that may not apply to the chosen gather mode.
 *
 * @param {Engine.Config.Settings} settings
 * @param {Engine.Gatherer.GatherMode} gatherMode
 */
function overrideSettingsForGatherMode(settings, gatherMode) {
  if (gatherMode === 'timespan') {
    if (settings.throttlingMethod === 'simulate') {
      settings.throttlingMethod = 'devtools';
    }
  }
}

/**
 * Overrides the quiet windows when throttlingMethod requires observation.
 *
 * @param {Engine.Config.Settings} settings
 */
function overrideThrottlingWindows(settings) {
  if (settings.throttlingMethod === 'simulate') return;

  settings.cpuQuietThresholdMs = Math.max(
    settings.cpuQuietThresholdMs || 0,
    nonSimulatedSettingsOverrides.cpuQuietThresholdMs
  );
  settings.networkQuietThresholdMs = Math.max(
    settings.networkQuietThresholdMs || 0,
    nonSimulatedSettingsOverrides.networkQuietThresholdMs
  );
  settings.pauseAfterFcpMs = Math.max(
    settings.pauseAfterFcpMs || 0,
    nonSimulatedSettingsOverrides.pauseAfterFcpMs
  );
  settings.pauseAfterLoadMs = Math.max(
    settings.pauseAfterLoadMs || 0,
    nonSimulatedSettingsOverrides.pauseAfterLoadMs
  );
}

/**
 * @param {Engine.Gatherer.GatherMode} gatherMode
 * @param {Engine.Config=} config
 * @param {Engine.Flags=} flags
 * @return {Promise<{resolvedConfig: Engine.Config.ResolvedConfig}>}
 */
async function initializeConfig(gatherMode, config, flags = {}) {
  const status = {msg: 'Initialize config', id: 'engine:config'};
  log.time(status, 'verbose');

  let {configWorkingCopy, configDir} = resolveWorkingCopy(config, flags);

  configWorkingCopy = resolveExtensions(configWorkingCopy);
  configWorkingCopy = await mergePlugins(configWorkingCopy, configDir, flags);

  const settings = resolveSettings(configWorkingCopy.settings || {}, flags);
  overrideSettingsForGatherMode(settings, gatherMode);
  overrideThrottlingWindows(settings);

  const artifacts = await resolveArtifactsToDefns(configWorkingCopy.artifacts, configDir);

  /** @type {Engine.Config.ResolvedConfig} */
  let resolvedConfig = {
    artifacts,
    audits: await resolveAuditsToDefns(configWorkingCopy.audits, configDir),
    categories: configWorkingCopy.categories || null,
    groups: configWorkingCopy.groups || null,
    settings,
  };

  assertValidConfig(resolvedConfig);

  resolvedConfig = filterConfigByGatherMode(resolvedConfig, gatherMode);
  resolvedConfig = filterConfigByExplicitFilters(resolvedConfig, settings);

  log.timeEnd(status);
  return {resolvedConfig};
}

/**
 * @param {Engine.Config.ResolvedConfig} resolvedConfig
 * @return {string}
 */
function getConfigDisplayString(resolvedConfig) {
  /** @type {Engine.Config.ResolvedConfig} */
  const resolvedConfigCopy = JSON.parse(JSON.stringify(resolvedConfig));

  if (resolvedConfigCopy.artifacts) {
    for (const artifactDefn of resolvedConfigCopy.artifacts) {
      // @ts-expect-error Breaking the Config.AnyArtifactDefn type.
      artifactDefn.gatherer = artifactDefn.gatherer.path;
      // Dependencies are not declared on Config JSON
      artifactDefn.dependencies = undefined;
    }
  }

  if (resolvedConfigCopy.audits) {
    for (const auditDefn of resolvedConfigCopy.audits) {
      // @ts-expect-error Breaking the Config.AuditDefn type.
      auditDefn.implementation = undefined;
      if (Object.keys(auditDefn.options).length === 0) {
        // @ts-expect-error Breaking the Config.AuditDefn type.
        auditDefn.options = undefined;
      }
    }
  }

  // Printed config is more useful with localized strings.
  format.replaceIcuMessages(resolvedConfigCopy, resolvedConfigCopy.settings.locale);

  return JSON.stringify(resolvedConfigCopy, null, 2);
}

export {
  resolveWorkingCopy,
  initializeConfig,
  getConfigDisplayString,
};

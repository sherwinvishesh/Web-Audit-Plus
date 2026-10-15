export default BaseGatherer;
/**
 * Base class for all gatherers.
 *
 * @implements {Engine.Gatherer.GathererInstance}
 */
declare class BaseGatherer implements Engine.Gatherer.GathererInstance {
    /** @type {Engine.Gatherer.GathererMeta} */
    meta: Engine.Gatherer.GathererMeta;
    /**
     * Method to start observing a page for an arbitrary period of time.
     * @param {Engine.Gatherer.Context} passContext
     * @return {Promise<void>|void}
     */
    startInstrumentation(passContext: Engine.Gatherer.Context): Promise<void> | void;
    /**
     * Method to start observing a page when the measurements are very sensitive and
     * should observe as little engine-induced work as possible.
     * @param {Engine.Gatherer.Context} passContext
     * @return {Promise<void>|void}
     */
    startSensitiveInstrumentation(passContext: Engine.Gatherer.Context): Promise<void> | void;
    /**
     * Method to stop observing a page when the measurements are very sensitive and
     * should observe as little engine-induced work as possible.
     *
     * @param {Engine.Gatherer.Context} passContext
     * @return {Promise<void>|void}
     */
    stopSensitiveInstrumentation(passContext: Engine.Gatherer.Context): Promise<void> | void;
    /**
     * Method to end observing a page after an arbitrary period of time.
     * @param {Engine.Gatherer.Context} passContext
     * @return {Promise<void>|void}
     */
    stopInstrumentation(passContext: Engine.Gatherer.Context): Promise<void> | void;
    /**
     * Method to gather results about a page.
     * @param {Engine.Gatherer.Context} passContext
     * @return {Engine.Gatherer.PhaseResult}
     */
    getArtifact(passContext: Engine.Gatherer.Context): Engine.Gatherer.PhaseResult;
}
import * as Engine from '../../types/engine.js';

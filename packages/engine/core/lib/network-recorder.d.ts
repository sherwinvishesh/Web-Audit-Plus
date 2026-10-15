export type NetworkRecorderEventMap = {
    requeststarted: [NetworkRequest];
    requestfinished: [NetworkRequest];
};
export type RequestEmitter = Engine.Protocol.StrictEventEmitterClass<NetworkRecorderEventMap>;
declare const NetworkRecorder_base: RequestEmitter;
export class NetworkRecorder extends NetworkRecorder_base {
    /**
     * @param {NetworkRequest} record The record to find the initiator of
     * @param {Map<string, NetworkRequest[]>} recordsByURL
     * @return {NetworkRequest|null}
     * @private
     */
    private static _chooseInitiatorRequest;
    /**
     * Construct network records from a log of devtools protocol messages.
     * @param {Engine.DevtoolsLog} devtoolsLog
     * @return {Array<Engine.Artifacts.NetworkRequest>}
     */
    static recordsFromLogs(devtoolsLog: Engine.DevtoolsLog): Array<Engine.Artifacts.NetworkRequest>;
    /** @type {NetworkRequest[]} */
    _records: NetworkRequest[];
    /** @type {Map<string, NetworkRequest>} */
    _recordsById: Map<string, NetworkRequest>;
    /**
     * Returns the array of raw network request data without finalizing the initiator and
     * redirect chain.
     * @return {Array<NetworkRequest>}
     */
    getRawRecords(): Array<NetworkRequest>;
    /**
     * Listener for the DevTools SDK NetworkManager's RequestStarted event, which includes both
     * web socket and normal request creation.
     * @param {NetworkRequest} request
     * @private
     */
    private onRequestStarted;
    /**
     * Listener for the DevTools SDK NetworkManager's RequestFinished event, which includes
     * request finish, failure, and redirect, as well as the closing of web sockets.
     * @param {NetworkRequest} request
     * @private
     */
    private onRequestFinished;
    /**
     * @param {{params: Engine.Crdp.Network.RequestWillBeSentEvent, targetType: Engine.Protocol.TargetType, sessionId?: string}} event
     */
    onRequestWillBeSent(event: {
        params: Engine.Crdp.Network.RequestWillBeSentEvent;
        targetType: Engine.Protocol.TargetType;
        sessionId?: string;
    }): void;
    /**
     * @param {{params: Engine.Crdp.Network.RequestServedFromCacheEvent, targetType: Engine.Protocol.TargetType, sessionId?: string}} event
     */
    onRequestServedFromCache(event: {
        params: Engine.Crdp.Network.RequestServedFromCacheEvent;
        targetType: Engine.Protocol.TargetType;
        sessionId?: string;
    }): void;
    /**
     * @param {{params: Engine.Crdp.Network.ResponseReceivedEvent, targetType: Engine.Protocol.TargetType, sessionId?: string}} event
     */
    onResponseReceived(event: {
        params: Engine.Crdp.Network.ResponseReceivedEvent;
        targetType: Engine.Protocol.TargetType;
        sessionId?: string;
    }): void;
    /**
     * @param {{params: Engine.Crdp.Network.ResponseReceivedExtraInfoEvent, targetType: Engine.Protocol.TargetType, sessionId?: string}} event
     */
    onResponseReceivedExtraInfo(event: {
        params: Engine.Crdp.Network.ResponseReceivedExtraInfoEvent;
        targetType: Engine.Protocol.TargetType;
        sessionId?: string;
    }): void;
    /**
     * @param {{params: Engine.Crdp.Network.DataReceivedEvent, targetType: Engine.Protocol.TargetType, sessionId?: string}} event
     */
    onDataReceived(event: {
        params: Engine.Crdp.Network.DataReceivedEvent;
        targetType: Engine.Protocol.TargetType;
        sessionId?: string;
    }): void;
    /**
     * @param {{params: Engine.Crdp.Network.LoadingFinishedEvent, targetType: Engine.Protocol.TargetType, sessionId?: string}} event
     */
    onLoadingFinished(event: {
        params: Engine.Crdp.Network.LoadingFinishedEvent;
        targetType: Engine.Protocol.TargetType;
        sessionId?: string;
    }): void;
    /**
     * @param {{params: Engine.Crdp.Network.LoadingFailedEvent, targetType: Engine.Protocol.TargetType, sessionId?: string}} event
     */
    onLoadingFailed(event: {
        params: Engine.Crdp.Network.LoadingFailedEvent;
        targetType: Engine.Protocol.TargetType;
        sessionId?: string;
    }): void;
    /**
     * @param {{params: Engine.Crdp.Network.ResourceChangedPriorityEvent, targetType: Engine.Protocol.TargetType, sessionId?: string}} event
     */
    onResourceChangedPriority(event: {
        params: Engine.Crdp.Network.ResourceChangedPriorityEvent;
        targetType: Engine.Protocol.TargetType;
        sessionId?: string;
    }): void;
    /**
     * Routes network events to their handlers, so we can construct networkRecords
     * @param {Engine.Protocol.RawEventMessage} event
     */
    dispatch(event: Engine.Protocol.RawEventMessage): void;
    /**
     * Redirected requests all have identical requestIds over the protocol. Once a request has been
     * redirected all future messages referrencing that requestId are about the new destination, not
     * the original. This method is a helper for finding the real request object to which the current
     * message is referring.
     *
     * @param {string} requestId
     * @param {Engine.Protocol.TargetType} targetType
     * @param {string|undefined} sessionId
     * @return {NetworkRequest|undefined}
     */
    _findRealRequestAndSetSession(requestId: string, targetType: Engine.Protocol.TargetType, sessionId: string | undefined): NetworkRequest | undefined;
}
import { NetworkRequest } from './network-request.js';
import * as Engine from '../../types/engine.js';
export {};

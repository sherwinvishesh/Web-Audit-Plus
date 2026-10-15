export { NetworkRecordsComputed as NetworkRecords };
declare const NetworkRecordsComputed: typeof NetworkRecords & {
    request: (dependencies: Engine.DevtoolsLog, context: Engine.Artifacts.ComputedContext) => Promise<import("../lib/network-request.js").NetworkRequest[]>;
};
declare class NetworkRecords {
    /**
     * @param {Engine.DevtoolsLog} devtoolsLog
     * @return {Promise<Array<Engine.Artifacts.NetworkRequest>>} networkRecords
     */
    static compute_(devtoolsLog: Engine.DevtoolsLog): Promise<Array<Engine.Artifacts.NetworkRequest>>;
}
import * as Engine from '../../types/engine.js';

import {DefaultPersistenceLayer} from './DefaultPersistenceLayer';
import {Logger} from '../logger/Logger';
import {Datastores} from './Datastores';
import {AdvertisingPersistenceLayer} from './advertiser/AdvertisingPersistenceLayer';
import {IListenablePersistenceLayer} from './IListenablePersistenceLayer';

const log = Logger.create();

/**
 * Persistence layer without going through the main process for added throughput
 * and lower IPC but requires node integration.
 */
export class ElectronRendererPersistenceLayerFactory {

    public static async create(): Promise<IListenablePersistenceLayer> {

        log.info("Using persistence layer from renderer process.");

        const datastore = Datastores.create();
        await datastore.init();

        const defaultPersistenceLayer = new DefaultPersistenceLayer(datastore);
        const advertisingPersistenceLayer = new AdvertisingPersistenceLayer(defaultPersistenceLayer);

        // note that we need to always pre-init before we return.
        await advertisingPersistenceLayer.init();

        return advertisingPersistenceLayer;

    }

}

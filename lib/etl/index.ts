// lib/etl/index.ts
// ETL Module Exports

export {
    BaseConnector,
    GoogleDriveConnector,
    GmailConnector,
    NotionConnector,
    SlackConnector,
    DropboxConnector,
    createConnector,
    runETLSync,
    type DiscoveredItem,
    type ProcessedItem,
    type ConnectorConfig,
} from './connectors';

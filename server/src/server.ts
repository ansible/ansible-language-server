import { TextDocument } from 'vscode-languageserver-textdocument';
import {
  Connection,
  createConnection,
  DidChangeTextDocumentParams,
  NotificationHandler,
  ProposedFeatures,
  TextDocuments,
} from 'vscode-languageserver/node';
import { AnsibleLanguageService } from './ansibleLanguageService';

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection: Connection = createConnection(ProposedFeatures.all);

const docChangeHandlers: NotificationHandler<DidChangeTextDocumentParams>[] = [];
connection.onDidChangeTextDocument((params) => {
  for (const handler of docChangeHandlers) {
    handler(params);
  }
});

// HACK: Using a connection proxy to allow multiple handlers
// This hack is necessary to simultaneously take advantage of the TextDocuments
// listener implementations and still be able to register handlers that it
// overrides, such as `onDidChangeTextDocument`.
const connectionProxy = new Proxy(connection, {
  get: (target, p, receiver) => {
    if (p === 'onDidChangeTextDocument') {
      return (handler: NotificationHandler<DidChangeTextDocumentParams>) => {
        docChangeHandlers.push(handler);
      };
    } else {
      return Reflect.get(target, p, receiver);
    }
  },
});

// Create a simple text document manager.
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

// function getDocumentSettings(resource: string): Thenable<ExtensionSettings> {
//   if (!hasConfigurationCapability) {
//     return Promise.resolve(globalSettings);
//   }
//   let result = documentSettings.get(resource);
//   if (!result) {
//     result = connection.workspace.getConfiguration({
//       scopeUri: resource,
//       section: 'languageServerExample',
//     });
//     documentSettings.set(resource, result);
//   }
//   return result;
// }

const context = new AnsibleLanguageService(connectionProxy, documents);
context.initialize();

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connectionProxy);
// Listen on the connection
connection.listen();
import * as path from 'path';
import * as protoLoader from '@grpc/proto-loader';
import * as grpc from '@grpc/grpc-js';

// Resolve proto paths from the src folder of the workspace
export const getProtoPath = (name: 'profile' | 'connection' | 'feed' | 'chat') => {
  // Since we are running in a local workspace, resolve directly to the source directory
  return path.resolve(__dirname, '..', 'src', 'protos', `${name}.proto`);
};

export const loadServiceDefinition = (name: 'profile' | 'connection' | 'feed' | 'chat'): any => {
  const pPath = getProtoPath(name);
  const packageDefinition = protoLoader.loadSync(pPath, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
  });
  return grpc.loadPackageDefinition(packageDefinition);
};

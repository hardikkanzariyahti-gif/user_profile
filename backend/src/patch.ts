const Module = require('module');
const originalLoad = Module._load;

Module._load = function patchedLoad(request: string, parent: any, isMain: boolean) {
  if (request === '@tensorflow/tfjs-node') {
    return require('@tensorflow/tfjs');
  }

  return originalLoad.call(this, request, parent, isMain);
};

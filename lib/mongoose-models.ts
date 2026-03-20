import mongoose from "mongoose";

export function getModelRegistry() {
  const instance = mongoose as typeof mongoose & {
    models?: Record<string, any>;
  };

  if (!instance.models) {
    instance.models = {};
  }

  return instance.models;
}

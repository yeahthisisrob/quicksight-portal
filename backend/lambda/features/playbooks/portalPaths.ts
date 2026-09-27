/** The portal API paths the spec steps call, built one way. */
export const authoringPath = (asset: { assetType: string; assetId: string }) =>
  `/api/authoring/${asset.assetType}/${encodeURIComponent(asset.assetId)}`;

export const datasetFieldsPath = (dataSetId: string) =>
  `/api/authoring/datasets/${encodeURIComponent(dataSetId)}/calculated-fields`;

/**
 * The context graph's ids for the things notes attach to, in one place so
 * the graph, the writers and the planner agree on them to the character.
 */
export function assetEntityId(assetType: string, assetId: string): string {
  return `${assetType}:${assetId}`;
}

/** A visual, by the asset it sits in and its own id (the layout element id). */
export function visualEntityId(assetType: string, assetId: string, visualId: string): string {
  return `visual:${assetType}:${assetId}:${visualId}`;
}

export function datasetEntityId(dataSetId: string): string {
  return `dataset:${dataSetId}`;
}

export function columnEntityId(dataSetId: string, column: string): string {
  return `dataset-column:${dataSetId}/${column}`;
}

/** The dataset id at the end of a dataset ARN, or the ARN itself when it is not one. */
export function dataSetIdOfArn(arn: string): string {
  return arn.split('/').pop() ?? arn;
}

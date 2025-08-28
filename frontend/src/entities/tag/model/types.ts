// Tag entity types

export interface Tag {
  key: string;
  value: string;
}

export interface TaggedResource {
  resourceId: string;
  resourceType: string;
  tags: Tag[];
}

// Tag API types
export interface TagInput {
  tags: Array<{ key: string; value: string }>;
}
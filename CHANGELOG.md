# Changelog

## [2.19.0](https://github.com/yeahthisisrob/quicksight-portal/compare/v2.18.0...v2.19.0) (2026-09-26)


### Features

* **authoring:** add filters to existing analyses by op, filter bar templates, and the planner's model in the chat ([#221](https://github.com/yeahthisisrob/quicksight-portal/issues/221)) ([24dcffa](https://github.com/yeahthisisrob/quicksight-portal/commit/24dcffa159e71a787db72d35460c974cdc8754a1))

## [2.18.0](https://github.com/yeahthisisrob/quicksight-portal/compare/v2.17.1...v2.18.0) (2026-09-26)


### Features

* **authoring:** filters as control-bar controls, layout by rule, an audience for every create, and the cache kept fresh after writes ([#219](https://github.com/yeahthisisrob/quicksight-portal/issues/219)) ([061530a](https://github.com/yeahthisisrob/quicksight-portal/commit/061530af17b1a2f9be1881c20823c41f80dda29a))

## [2.17.1](https://github.com/yeahthisisrob/quicksight-portal/compare/v2.17.0...v2.17.1) (2026-09-26)


### Bug Fixes

* **assistant:** check a prepared write against the contract and its preview before offering Run ([#217](https://github.com/yeahthisisrob/quicksight-portal/issues/217)) ([1204d86](https://github.com/yeahthisisrob/quicksight-portal/commit/1204d8621cc743165b9e54704bd96cd54837b03d))

## [2.17.0](https://github.com/yeahthisisrob/quicksight-portal/compare/v2.16.3...v2.17.0) (2026-09-26)


### Features

* **assistant:** a context graph shaped like AWS Context, plans before building, and per-org authoring guidance ([#215](https://github.com/yeahthisisrob/quicksight-portal/issues/215)) ([5b5a064](https://github.com/yeahthisisrob/quicksight-portal/commit/5b5a06405b406952a1bbd0dbd1ead4020229ed79))

## [2.16.3](https://github.com/yeahthisisrob/quicksight-portal/compare/v2.16.2...v2.16.3) (2026-09-25)


### Bug Fixes

* **author:** the assistant knows the portal (SMUS projects, governed datasets, the catalog, templates), and the worker can see SMUS ([#213](https://github.com/yeahthisisrob/quicksight-portal/issues/213)) ([bfe37e9](https://github.com/yeahthisisrob/quicksight-portal/commit/bfe37e9b9391408efc805e1a593f0fa2929a4d73))

## [2.16.2](https://github.com/yeahthisisrob/quicksight-portal/compare/v2.16.1...v2.16.2) (2026-09-25)


### Bug Fixes

* **author:** the assistant finishes the work instead of ending on "let me check", and the chat says when nothing is running ([#211](https://github.com/yeahthisisrob/quicksight-portal/issues/211)) ([17bd910](https://github.com/yeahthisisrob/quicksight-portal/commit/17bd9102d1617018d8a36c4a927c6024d103a987))

## [2.16.1](https://github.com/yeahthisisrob/quicksight-portal/compare/v2.16.0...v2.16.1) (2026-09-25)


### Bug Fixes

* **author:** the assistant says what it is doing, runs the planner itself and waits for it, follows the jobs its actions start, and keeps the conversation across reloads ([#209](https://github.com/yeahthisisrob/quicksight-portal/issues/209)) ([f2cec70](https://github.com/yeahthisisrob/quicksight-portal/commit/f2cec70128348cc13241d96e8ad889da3b2aa714))

## [2.16.0](https://github.com/yeahthisisrob/quicksight-portal/compare/v2.15.2...v2.16.0) (2026-09-25)


### Features

* **author:** an assistant that reads, draws and prepares changes, and a choice of five models with rough costs ([#207](https://github.com/yeahthisisrob/quicksight-portal/issues/207)) ([d51d1f7](https://github.com/yeahthisisrob/quicksight-portal/commit/d51d1f7beb8ff1cbaedf90ce4853e15ba66f7df8))

## [2.15.2](https://github.com/yeahthisisrob/quicksight-portal/compare/v2.15.1...v2.15.2) (2026-09-24)


### Bug Fixes

* **build:** the ?raw module declaration is a tracked .ts, not a git-ignored .d.ts ([#203](https://github.com/yeahthisisrob/quicksight-portal/issues/203)) ([a34655c](https://github.com/yeahthisisrob/quicksight-portal/commit/a34655c78db0945ade374cad278197b83e886868))

## [2.15.1](https://github.com/yeahthisisrob/quicksight-portal/compare/v2.15.0...v2.15.1) (2026-09-24)


### Bug Fixes

* **build:** the dev and watch builds resolve the guide's ?raw import like the production build ([#201](https://github.com/yeahthisisrob/quicksight-portal/issues/201)) ([97c7cfe](https://github.com/yeahthisisrob/quicksight-portal/commit/97c7cfe349bb26b524bbf82b8af7adbc0a6237fe))

## [2.15.0](https://github.com/yeahthisisrob/quicksight-portal/compare/v2.14.5...v2.15.0) (2026-09-24)


### Features

* **api:** the portal as an API product - a served contract and guide, publish a definition you built, the planner as a job, and an API tab on Author ([#199](https://github.com/yeahthisisrob/quicksight-portal/issues/199)) ([4d235aa](https://github.com/yeahthisisrob/quicksight-portal/commit/4d235aaa8096ff2b3201b997ba3f6a090c899ad2))

## [2.14.5](https://github.com/yeahthisisrob/quicksight-portal/compare/v2.14.4...v2.14.5) (2026-09-23)


### Bug Fixes

* **author:** a dataset made inline gets a logical table and an audience, and an added field that reads a missing column is refused before publish ([#196](https://github.com/yeahthisisrob/quicksight-portal/issues/196)) ([7d4f707](https://github.com/yeahthisisrob/quicksight-portal/commit/7d4f707254fd648aef2eebd625df678d595f76eb))

## [2.14.4](https://github.com/yeahthisisrob/quicksight-portal/compare/v2.14.3...v2.14.4) (2026-09-21)


### Bug Fixes

* **planner:** let the Lambda read its Bedrock model's Marketplace subscription ([#193](https://github.com/yeahthisisrob/quicksight-portal/issues/193)) ([fad2ac4](https://github.com/yeahthisisrob/quicksight-portal/commit/fad2ac4f1e4dad05eb00f7dc320436e46b768557))

## [2.14.3](https://github.com/yeahthisisrob/quicksight-portal/compare/v2.14.2...v2.14.3) (2026-09-19)


### Bug Fixes

* **catalog:** a dataset's calculated fields reach the field cache, and an exploration's know which dataset they belong to ([#189](https://github.com/yeahthisisrob/quicksight-portal/issues/189)) ([104f7ae](https://github.com/yeahthisisrob/quicksight-portal/commit/104f7aeed5dafa23bf2e5cce9386df63ba157b6e))

## [2.14.2](https://github.com/yeahthisisrob/quicksight-portal/compare/v2.14.1...v2.14.2) (2026-09-19)


### Bug Fixes

* **smus:** one definition of which listings count, so a dataset cannot be governed on one page and ungoverned on the next ([#187](https://github.com/yeahthisisrob/quicksight-portal/issues/187)) ([a62f802](https://github.com/yeahthisisrob/quicksight-portal/commit/a62f802d1651d1befba35692037e4445bf1ea1be))

## [2.14.1](https://github.com/yeahthisisrob/quicksight-portal/compare/v2.14.0...v2.14.1) (2026-09-19)


### Bug Fixes

* **data-catalog:** a dataset built on a governed one keeps its listing, and the chain is drawn again ([#185](https://github.com/yeahthisisrob/quicksight-portal/issues/185)) ([34dfcfb](https://github.com/yeahthisisrob/quicksight-portal/commit/34dfcfb3f6b3165501f58172a0c01f8770f37f48))

## [2.14.0](https://github.com/yeahthisisrob/quicksight-portal/compare/v2.13.2...v2.14.0) (2026-09-19)


### Features

* **data-catalog:** the field tabs read the SMUS projects, with what falls outside one click away ([#183](https://github.com/yeahthisisrob/quicksight-portal/issues/183)) ([35d49e5](https://github.com/yeahthisisrob/quicksight-portal/commit/35d49e502e1ba4b28d97c50395fcfd3a2b8c37e5))

## [2.13.2](https://github.com/yeahthisisrob/quicksight-portal/compare/v2.13.1...v2.13.2) (2026-09-19)


### Bug Fixes

* **data-catalog:** the SMUS tab stops pinning the project, and a listing is found by its table as well as its name ([#181](https://github.com/yeahthisisrob/quicksight-portal/issues/181)) ([67f695e](https://github.com/yeahthisisrob/quicksight-portal/commit/67f695e9adbbf1885a89d732b725856fda1e60c6))

## [2.13.1](https://github.com/yeahthisisrob/quicksight-portal/compare/v2.13.0...v2.13.1) (2026-09-19)


### Bug Fixes

* **data-catalog:** stop hiding QuickSight's own fields behind SMUS, and read datasets again after the data prep change ([#179](https://github.com/yeahthisisrob/quicksight-portal/issues/179)) ([cf75ff9](https://github.com/yeahthisisrob/quicksight-portal/commit/cf75ff9b3ca6b98218fb559ed2be8fd50709e838))

## [2.13.0](https://github.com/yeahthisisrob/quicksight-portal/compare/v2.12.1...v2.13.0) (2026-09-19)


### Features

* **datasets:** parity with the new data prep experience, on both the read and the write side ([#178](https://github.com/yeahthisisrob/quicksight-portal/issues/178)) ([f211c8e](https://github.com/yeahthisisrob/quicksight-portal/commit/f211c8eb9aebdeaf88a1fddb3808f07b1c57b9e2))


### Bug Fixes

* **smus:** read a listing's columns whatever shape the domain returns them in, and say when there are none ([#176](https://github.com/yeahthisisrob/quicksight-portal/issues/176)) ([867284c](https://github.com/yeahthisisrob/quicksight-portal/commit/867284cd7af6504bf38c321464e55e787dbc63a8))

## [2.12.1](https://github.com/yeahthisisrob/quicksight-portal/compare/v2.12.0...v2.12.1) (2026-09-19)


### Bug Fixes

* **data-catalog:** take the best SMUS tie-back of a column's datasets, and say which of the two gaps it hit ([#174](https://github.com/yeahthisisrob/quicksight-portal/issues/174)) ([a9f4a37](https://github.com/yeahthisisrob/quicksight-portal/commit/a9f4a37f7f661ed1e5dd1a2f903a794a3a41db47))

## [2.12.0](https://github.com/yeahthisisrob/quicksight-portal/compare/v2.11.2...v2.12.0) (2026-09-19)


### Features

* **author:** a dashboard from nothing - pick datasets, describe it or name the columns, publish it ([#171](https://github.com/yeahthisisrob/quicksight-portal/issues/171)) ([13647f6](https://github.com/yeahthisisrob/quicksight-portal/commit/13647f6c24482b52a143245615f495cb59482a86))
* **authoring:** a dataset's columns as an endpoint, so building from nothing never reads an export's shape ([#173](https://github.com/yeahthisisrob/quicksight-portal/issues/173)) ([66b8792](https://github.com/yeahthisisrob/quicksight-portal/commit/66b8792472861b01a60692cb2e19f4347992ee9c))

## [2.11.2](https://github.com/yeahthisisrob/quicksight-portal/compare/v2.11.1...v2.11.2) (2026-09-19)


### Bug Fixes

* **data-catalog:** columns tie back to SMUS through a rename, and the datasets cell scales ([#169](https://github.com/yeahthisisrob/quicksight-portal/issues/169)) ([c9eb03c](https://github.com/yeahthisisrob/quicksight-portal/commit/c9eb03c9dc33963119357618691aa30e4c951753))

## [2.11.1](https://github.com/yeahthisisrob/quicksight-portal/compare/v2.11.0...v2.11.1) (2026-09-19)


### Bug Fixes

* **data-catalog:** the Columns tab no longer crashes on a column the export could not type ([#167](https://github.com/yeahthisisrob/quicksight-portal/issues/167)) ([fdb4a5a](https://github.com/yeahthisisrob/quicksight-portal/commit/fdb4a5a8ec7f38cc6b370ba52758e37a4196fd5e))

## [2.11.0](https://github.com/yeahthisisrob/quicksight-portal/compare/v2.10.0...v2.11.0) (2026-09-19)


### Features

* **authoring:** a dashboard or analysis from nothing - visuals by column names, planner-proposed from an ask, on a template standard ([#163](https://github.com/yeahthisisrob/quicksight-portal/issues/163)) ([adc7f4c](https://github.com/yeahthisisrob/quicksight-portal/commit/adc7f4c68aebb138dc0e3d7f15f932a39b7ff8b6))
* **authoring:** cross-dataset filter checks - preview and apply say which datasets a filter cannot reach ([#165](https://github.com/yeahthisisrob/quicksight-portal/issues/165)) ([485fa5e](https://github.com/yeahthisisrob/quicksight-portal/commit/485fa5e35c7c12a220e0a303e3e725824cdf43af))
* **author:** the Standard step - migrate onto a template dashboard and convert visual types in bulk ([#166](https://github.com/yeahthisisrob/quicksight-portal/issues/166)) ([45ee697](https://github.com/yeahthisisrob/quicksight-portal/commit/45ee6973b5baf313c2cf19ba75b0291d98c65e92))

## [2.10.0](https://github.com/yeahthisisrob/quicksight-portal/compare/v2.9.0...v2.10.0) (2026-09-19)


### Features

* **authoring:** type rules - chart family swaps, KPI standardisation and column casts across a whole definition ([#160](https://github.com/yeahthisisrob/quicksight-portal/issues/160)) ([abb49b2](https://github.com/yeahthisisrob/quicksight-portal/commit/abb49b246e615d9fd82b9833defe6502c2ee2b20))


### Bug Fixes

* **authoring:** a template field never refuses a publish over a name, and its test no longer imports the AWS SDK mid-test ([#162](https://github.com/yeahthisisrob/quicksight-portal/issues/162)) ([0952f5e](https://github.com/yeahthisisrob/quicksight-portal/commit/0952f5ebdcc4ee577eaae30506219493be2d398b))

## [2.9.0](https://github.com/yeahthisisrob/quicksight-portal/compare/v2.8.0...v2.9.0) (2026-09-19)


### Features

* **authoring:** migrate onto a template dashboard's layout standard through the same preview and apply ([#158](https://github.com/yeahthisisrob/quicksight-portal/issues/158)) ([6158b4b](https://github.com/yeahthisisrob/quicksight-portal/commit/6158b4bd7a231baeb14b582343922a02475960b3))
* **catalog:** field-first catalog - every calculated field, its usage, its conflicts and its lineage tied to SMUS ([#159](https://github.com/yeahthisisrob/quicksight-portal/issues/159)) ([5677f91](https://github.com/yeahthisisrob/quicksight-portal/commit/5677f91010de2bc2c0b47bdc00c5d9ff661ffb5b))


### Bug Fixes

* **search:** the index skips entries without a name instead of failing the whole search ([#156](https://github.com/yeahthisisrob/quicksight-portal/issues/156)) ([6040b3c](https://github.com/yeahthisisrob/quicksight-portal/commit/6040b3c4b61a9dbdf9c5500b6b9080989378a234))

## [2.8.0](https://github.com/yeahthisisrob/quicksight-portal/compare/v2.7.0...v2.8.0) (2026-09-19)


### Features

* **activity:** timeline redesign with provenance - who changed what, including the agents ([#155](https://github.com/yeahthisisrob/quicksight-portal/issues/155)) ([a9a1496](https://github.com/yeahthisisrob/quicksight-portal/commit/a9a149677a47698a4f7601f55e59f151d0f8ec39))
* **search:** one ranked search over everything, in plain words - Cmd+K, Author pickers, catalog, API ([#153](https://github.com/yeahthisisrob/quicksight-portal/issues/153)) ([f758e9a](https://github.com/yeahthisisrob/quicksight-portal/commit/f758e9ada74ded49bf87cdd5068c6923061806c8))

## [2.7.0](https://github.com/yeahthisisrob/quicksight-portal/compare/v2.6.0...v2.7.0) (2026-09-19)


### Features

* **authoring:** repair assets QuickSight refuses to write, and per-visual load times on the wireframe ([#152](https://github.com/yeahthisisrob/quicksight-portal/issues/152)) ([93b4258](https://github.com/yeahthisisrob/quicksight-portal/commit/93b425852bbaa43925bb5acc4d80592c3ac545d5))


### Bug Fixes

* **ci:** the story smoke warms the dev server and retries a timeout, and can filter to touched stories ([#150](https://github.com/yeahthisisrob/quicksight-portal/issues/150)) ([205f70b](https://github.com/yeahthisisrob/quicksight-portal/commit/205f70b6590d85204feff6a542536344603bcf9f))

## [2.6.0](https://github.com/yeahthisisrob/quicksight-portal/compare/v2.5.1...v2.6.0) (2026-09-19)


### Features

* **api:** API keys for machine callers, an API guide and just api; mockup arrows swap visuals ([#148](https://github.com/yeahthisisrob/quicksight-portal/issues/148)) ([589fc33](https://github.com/yeahthisisrob/quicksight-portal/commit/589fc33d9afd3ce4b58e3d3139331b8a799273ed))

## [2.5.1](https://github.com/yeahthisisrob/quicksight-portal/compare/v2.5.0...v2.5.1) (2026-09-19)


### Bug Fixes

* **catalog:** the catalog loads again - visual usage comes from the export, not a placeholder built per request ([#147](https://github.com/yeahthisisrob/quicksight-portal/issues/147)) ([73b5c4d](https://github.com/yeahthisisrob/quicksight-portal/commit/73b5c4d4ee70f9f930b68b9b54936d17a6082b3a))
* **catalog:** the page's first request lists projects from the snapshot without building the field index ([#145](https://github.com/yeahthisisrob/quicksight-portal/issues/145)) ([4a5c2a4](https://github.com/yeahthisisrob/quicksight-portal/commit/4a5c2a44c441ea9d5ecc24755b4e1b7f8c13caef))

## [2.5.0](https://github.com/yeahthisisrob/quicksight-portal/compare/v2.4.2...v2.5.0) (2026-09-19)


### Features

* **smus:** SMUS export job and snapshot; Operations page on the design system; asset table column order ([#142](https://github.com/yeahthisisrob/quicksight-portal/issues/142)) ([40113cf](https://github.com/yeahthisisrob/quicksight-portal/commit/40113cf0d3f9c8d89d985e5fe52e780454b3119e))


### Bug Fixes

* **smus:** the export job carries the resolved SMUS config, and the projects picker is live again ([#144](https://github.com/yeahthisisrob/quicksight-portal/issues/144)) ([c3d4d45](https://github.com/yeahthisisrob/quicksight-portal/commit/c3d4d45d6a18676f4974d258990dbc0d625a50cd))

## [2.4.2](https://github.com/yeahthisisrob/quicksight-portal/compare/v2.4.1...v2.4.2) (2026-09-19)


### Bug Fixes

* **smus:** project discovery bounds every upstream call so the picker gets an answer ([#140](https://github.com/yeahthisisrob/quicksight-portal/issues/140)) ([577d4f7](https://github.com/yeahthisisrob/quicksight-portal/commit/577d4f7a5f6d1f02a942c7602555c57fb327d2b1))

## [2.4.1](https://github.com/yeahthisisrob/quicksight-portal/compare/v2.4.0...v2.4.1) (2026-09-19)


### Bug Fixes

* **settings:** the project picker never asked the API, and the SMUS gate reads the selection ([#138](https://github.com/yeahthisisrob/quicksight-portal/issues/138)) ([cb546bb](https://github.com/yeahthisisrob/quicksight-portal/commit/cb546bb024c7138d5c8da28d7c0442859d2fd2f7))

## [2.4.0](https://github.com/yeahthisisrob/quicksight-portal/compare/v2.3.0...v2.4.0) (2026-09-19)


### Features

* **author:** the full authoring studio - ranked sources with insights, mockup editor, change list, folder publish, health columns ([#137](https://github.com/yeahthisisrob/quicksight-portal/issues/137)) ([1584048](https://github.com/yeahthisisrob/quicksight-portal/commit/15840481b2cd448686f755cf8b1def5157153335))


### Bug Fixes

* **smus:** find the Lambda role by prefix - CDK suffixes the logical id ([#133](https://github.com/yeahthisisrob/quicksight-portal/issues/133)) ([71ebea3](https://github.com/yeahthisisrob/quicksight-portal/commit/71ebea381c2a392feb630699e8c440cc76e825ce))
* **smus:** project discovery names the calling role and its domain profile ([#136](https://github.com/yeahthisisrob/quicksight-portal/issues/136)) ([a453eb9](https://github.com/yeahthisisrob/quicksight-portal/commit/a453eb91bbcca74c729fbe23df29e56e2147931c))
* **smus:** smus-grant carries on when the role's domain profile already exists ([#135](https://github.com/yeahthisisrob/quicksight-portal/issues/135)) ([cc98b72](https://github.com/yeahthisisrob/quicksight-portal/commit/cc98b720b42e3dc66123ac21e376bd5ab68e8503))

## [2.3.0](https://github.com/yeahthisisrob/quicksight-portal/compare/v2.2.0...v2.3.0) (2026-09-19)


### Features

* **smus:** just smus-grant registers the portal role in the domain and its projects ([#132](https://github.com/yeahthisisrob/quicksight-portal/issues/132)) ([6f56759](https://github.com/yeahthisisrob/quicksight-portal/commit/6f5675919b7d561d41416eba661c513226fef5db))


### Bug Fixes

* **smus:** say why the project picker is empty ([#130](https://github.com/yeahthisisrob/quicksight-portal/issues/130)) ([61a0d3b](https://github.com/yeahthisisrob/quicksight-portal/commit/61a0d3b6a298e78fc87be94bb3c6c5f20806f5ea))

## [2.2.0](https://github.com/yeahthisisrob/quicksight-portal/compare/v2.1.0...v2.2.0) (2026-09-19)


### Features

* **catalog:** SMUS-first catalog with lineage, conflicts and a calculated-field template library; whole-page stories ([#129](https://github.com/yeahthisisrob/quicksight-portal/issues/129)) ([93575a0](https://github.com/yeahthisisrob/quicksight-portal/commit/93575a00f684949f04e94ca5066d950171a9ed3d))


### Bug Fixes

* **smus:** discover projects from published listings, not only the role's memberships ([#127](https://github.com/yeahthisisrob/quicksight-portal/issues/127)) ([0e4feec](https://github.com/yeahthisisrob/quicksight-portal/commit/0e4feec074dab502fa177fa39568bbfe20bf2520))

## [2.1.0](https://github.com/yeahthisisrob/quicksight-portal/compare/v2.0.0...v2.1.0) (2026-09-19)


### Features

* **author:** Author page with planner, wireframe mockups, SMUS assets, settings, operations and a rebuilt design system ([#126](https://github.com/yeahthisisrob/quicksight-portal/issues/126)) ([7deefca](https://github.com/yeahthisisrob/quicksight-portal/commit/7deefca066a8484bc14e7b14cf239998fef5f327))


### Bug Fixes

* **cdk:** acknowledge the Bedrock wildcard ARNs so cdk-nag lets the stack deploy ([#124](https://github.com/yeahthisisrob/quicksight-portal/issues/124)) ([90dd15d](https://github.com/yeahthisisrob/quicksight-portal/commit/90dd15da4835c15703615c88a10dfc3df1b60bed))

## [2.0.0](https://github.com/yeahthisisrob/quicksight-portal/compare/v1.14.4...v2.0.0) (2026-09-18)


### Features

* **authoring:** rebind dashboards and analyses to other datasets, with a planner and a wireframe viewer ([#123](https://github.com/yeahthisisrob/quicksight-portal/issues/123)) ([2a54b56](https://github.com/yeahthisisrob/quicksight-portal/commit/2a54b56b00c6fad1529b046bbe511ab643f7efe5))
* **datasets:** edit where a dataset reads from — schema, table, custom SQL, data source ([#121](https://github.com/yeahthisisrob/quicksight-portal/issues/121)) ([332d43c](https://github.com/yeahthisisrob/quicksight-portal/commit/332d43c7abd4ea9325f578f436114181f7537cb3))

## [1.14.4](https://github.com/yeahthisisrob/quicksight-portal/compare/v1.14.3...v1.14.4) (2026-09-18)


### Bug Fixes

* **frontend:** blank page after login — Rolldown produced a cyclic chunk graph ([#119](https://github.com/yeahthisisrob/quicksight-portal/issues/119)) ([f2b38e0](https://github.com/yeahthisisrob/quicksight-portal/commit/f2b38e0af2547710853e77b18280eba4ca0ee155))
* **ts:** repair the TypeScript 7 module settings and make the CDK app emit-free ([#117](https://github.com/yeahthisisrob/quicksight-portal/issues/117)) ([ca3e8b3](https://github.com/yeahthisisrob/quicksight-portal/commit/ca3e8b31e4edb46645d578367dcac7b8c6c49e0b))

## [1.14.3](https://github.com/yeahthisisrob/quicksight-portal/compare/v1.14.2...v1.14.3) (2026-09-18)


### Bug Fixes

* **lint:** make Biome respect .gitignore so generated files stop failing checks ([#115](https://github.com/yeahthisisrob/quicksight-portal/issues/115)) ([5633369](https://github.com/yeahthisisrob/quicksight-portal/commit/56333698286669ec2b11243ca753bf38d4935a63))

## [1.14.2](https://github.com/yeahthisisrob/quicksight-portal/compare/v1.14.1...v1.14.2) (2026-09-18)


### Bug Fixes

* adding users to groups sent [null] user names; bulk jobs now record why each item failed ([#111](https://github.com/yeahthisisrob/quicksight-portal/issues/111)) ([0676e3b](https://github.com/yeahthisisrob/quicksight-portal/commit/0676e3be27a0d11f5808061be0a54a0948ab12ed))

## [1.14.1](https://github.com/yeahthisisrob/quicksight-portal/compare/v1.14.0...v1.14.1) (2026-08-29)


### Bug Fixes

* cdk-nag ARN acknowledgments match both env-less synth and real deploys ([#92](https://github.com/yeahthisisrob/quicksight-portal/issues/92)) ([8d55047](https://github.com/yeahthisisrob/quicksight-portal/commit/8d550470e93c096e38feebaa3c98e1ab91feab43))

## [1.14.0](https://github.com/yeahthisisrob/quicksight-portal/compare/v1.13.1...v1.14.0) (2026-08-29)


### Features

* rename assets live in QuickSight from the asset tables ([#90](https://github.com/yeahthisisrob/quicksight-portal/issues/90)) ([715fa7d](https://github.com/yeahthisisrob/quicksight-portal/commit/715fa7d36be476670cb622c460bb22f36986b0c5))

## [1.13.1](https://github.com/yeahthisisrob/quicksight-portal/compare/v1.13.0...v1.13.1) (2026-08-29)


### Chores

* maintenance - Dependabot, dependency bumps, cdk-nag guardrail, README refresh ([#71](https://github.com/yeahthisisrob/quicksight-portal/issues/71)) ([dec22e5](https://github.com/yeahthisisrob/quicksight-portal/commit/dec22e50b9f9971ff58fee7abc91e0b727898c4b))

## [1.13.0](https://github.com/yeahthisisrob/quicksight-portal/compare/v1.12.2...v1.13.0) (2026-08-29)


### Features

* job service on DynamoDB - per-job records, item-per-line logs, atomic heartbeats, race-free export lock ([#69](https://github.com/yeahthisisrob/quicksight-portal/issues/69)) ([252070a](https://github.com/yeahthisisrob/quicksight-portal/commit/252070a7e0ec4c818c87c43e6beed3a1dbfa4d50))

## [1.12.2](https://github.com/yeahthisisrob/quicksight-portal/compare/v1.12.1...v1.12.2) (2026-08-29)


### Bug Fixes

* export survives Lambda timeout via checkpoint/resume; single-export mutex; incremental cache upserts ([#67](https://github.com/yeahthisisrob/quicksight-portal/issues/67)) ([7e1647c](https://github.com/yeahthisisrob/quicksight-portal/commit/7e1647c8201c8d953ade8e53487c34c82ab5233d))

## [1.12.1](https://github.com/yeahthisisrob/quicksight-portal/compare/v1.12.0...v1.12.1) (2026-08-23)


### Bug Fixes

* cache rebuild no longer wipes job history; Smart Sync restores cache from S3 instead of full re-export ([#65](https://github.com/yeahthisisrob/quicksight-portal/issues/65)) ([319242b](https://github.com/yeahthisisrob/quicksight-portal/commit/319242b53b15c7d5b0c16a72ecda686db99c15be))

## [1.12.0](https://github.com/yeahthisisrob/quicksight-portal/compare/v1.11.0...v1.12.0) (2026-08-23)


### Features

* sheets/visuals columns for dashboards+analyses, user-access filter on asset pages ([#63](https://github.com/yeahthisisrob/quicksight-portal/issues/63)) ([943fc71](https://github.com/yeahthisisrob/quicksight-portal/commit/943fc71c3a3d5d481b708c47dd6aafc6edaa1ba7))

## [1.11.0](https://github.com/yeahthisisrob/quicksight-portal/compare/v1.10.7...v1.11.0) (2026-08-23)


### Features

* composite dataset lineage - dataset-to-dataset uses/used_by, multi-hop transitive walk, graceful lineage degradation ([#61](https://github.com/yeahthisisrob/quicksight-portal/issues/61)) ([a4e8b45](https://github.com/yeahthisisrob/quicksight-portal/commit/a4e8b4545032a430812c8ccc23a62f9d113ed612))

## [1.10.7](https://github.com/yeahthisisrob/quicksight-portal/compare/v1.10.6...v1.10.7) (2026-08-22)


### Bug Fixes

* close OpenAPI schema gaps; group membership dialogs now actually track their jobs ([#59](https://github.com/yeahthisisrob/quicksight-portal/issues/59)) ([fda719a](https://github.com/yeahthisisrob/quicksight-portal/commit/fda719a95372f8d7699e7c49a719c475a70432d4))


### Code Refactoring

* break warmer import cycle via cache rebuild hooks, harden job-index writes ([#57](https://github.com/yeahthisisrob/quicksight-portal/issues/57)) ([345ef7b](https://github.com/yeahthisisrob/quicksight-portal/commit/345ef7bc10556b8a23dde778921258117723b004))
* consolidate frontend duplications from the audit ([#60](https://github.com/yeahthisisrob/quicksight-portal/issues/60)) ([b263d1a](https://github.com/yeahthisisrob/quicksight-portal/commit/b263d1abea6cf399388d70f80c406ba40981ccb3))

## [1.10.6](https://github.com/yeahthisisrob/quicksight-portal/compare/v1.10.5...v1.10.6) (2026-08-22)


### Bug Fixes

* deleted assets lingering in lists, bulk jobs falsely shown as timed out, cache hardening ([#55](https://github.com/yeahthisisrob/quicksight-portal/issues/55)) ([e88d652](https://github.com/yeahthisisrob/quicksight-portal/commit/e88d6522ca207446f62bc4596bd4a2941841d24f))

## [1.10.5](https://github.com/yeahthisisrob/quicksight-portal/compare/v1.10.4...v1.10.5) (2026-08-22)


### Bug Fixes

* adopt generated OpenAPI types over hand-rolled duplicates ([#53](https://github.com/yeahthisisrob/quicksight-portal/issues/53)) ([6443b62](https://github.com/yeahthisisrob/quicksight-portal/commit/6443b62a9c86bdd28b0bc4febdc73853efdd4346))

## [1.10.4](https://github.com/yeahthisisrob/quicksight-portal/compare/v1.10.3...v1.10.4) (2026-08-22)


### Bug Fixes

* enforce FSD boundaries in lint and fix the violations they allowed ([#51](https://github.com/yeahthisisrob/quicksight-portal/issues/51)) ([ff0779e](https://github.com/yeahthisisrob/quicksight-portal/commit/ff0779ef3b13598a41a8b37b544058d0ccbcf834))

## [1.10.3](https://github.com/yeahthisisrob/quicksight-portal/compare/v1.10.2...v1.10.3) (2026-08-22)


### Code Refactoring

* consolidate CacheReader onto shared pagination utilities ([#49](https://github.com/yeahthisisrob/quicksight-portal/issues/49)) ([ca24437](https://github.com/yeahthisisrob/quicksight-portal/commit/ca244373b891c1f642b2d86a7aeaea5cf9d72ccc))

## [1.10.2](https://github.com/yeahthisisrob/quicksight-portal/compare/v1.10.1...v1.10.2) (2026-08-22)


### Bug Fixes

* active-first relationship sort, missing collection sort keys, catalog truncation, group-removal race ([#46](https://github.com/yeahthisisrob/quicksight-portal/issues/46)) ([13a6360](https://github.com/yeahthisisrob/quicksight-portal/commit/13a6360e83f327ed2c4f25b200d19f9bfdc3ae09))

## [1.10.1](https://github.com/yeahthisisrob/quicksight-portal/compare/v1.10.0...v1.10.1) (2026-08-18)


### Bug Fixes

* re-export assets when parser metadata is stale; derive Athena schemas from custom SQL ([#44](https://github.com/yeahthisisrob/quicksight-portal/issues/44)) ([688fcdf](https://github.com/yeahthisisrob/quicksight-portal/commit/688fcdf45b99addc6d63e494a54cc94087ec01cd))

## [1.10.0](https://github.com/yeahthisisrob/quicksight-portal/compare/v1.9.0...v1.10.0) (2026-08-18)


### Features

* readable activity event fields, shape-proof id extraction ([#42](https://github.com/yeahthisisrob/quicksight-portal/issues/42)) ([ed0072f](https://github.com/yeahthisisrob/quicksight-portal/commit/ed0072fad00de913ee36a6bc487fd00c256c80b4))

## [1.9.0](https://github.com/yeahthisisrob/quicksight-portal/compare/v1.8.2...v1.9.0) (2026-08-17)


### Features

* timeline event JSON view, allowlisted CT capture for mutations, single-line activity chips ([#40](https://github.com/yeahthisisrob/quicksight-portal/issues/40)) ([2ce8aeb](https://github.com/yeahthisisrob/quicksight-portal/commit/2ce8aeb1233794747865b29471570bcfb5a1d74a))

## [1.8.2](https://github.com/yeahthisisrob/quicksight-portal/compare/v1.8.1...v1.8.2) (2026-08-17)


### Bug Fixes

* v7 cell alignment via colDef display flex, table typography and chip cleanup, density-true compact ([#38](https://github.com/yeahthisisrob/quicksight-portal/issues/38)) ([aa02ea4](https://github.com/yeahthisisrob/quicksight-portal/commit/aa02ea4014bd70527618f69fb13594af7f87ccb2))

## [1.8.1](https://github.com/yeahthisisrob/quicksight-portal/compare/v1.8.0...v1.8.1) (2026-08-17)


### Bug Fixes

* resolve npm audit vulnerabilities in root workspace ([#36](https://github.com/yeahthisisrob/quicksight-portal/issues/36)) ([acb3458](https://github.com/yeahthisisrob/quicksight-portal/commit/acb34583164f9755190b31185bea5caa631f436c))

## [1.8.0](https://github.com/yeahthisisrob/quicksight-portal/compare/v1.7.0...v1.8.0) (2026-08-17)


### Features

* upgrade MUI X DataGrid to v7 - free column resizing ([#34](https://github.com/yeahthisisrob/quicksight-portal/issues/34)) ([f73b868](https://github.com/yeahthisisrob/quicksight-portal/commit/f73b868c99d5bdf5535bd924debc357656e16fbe))

## [1.7.0](https://github.com/yeahthisisrob/quicksight-portal/compare/v1.6.0...v1.7.0) (2026-08-17)


### Features

* prioritize physical table identity in SMUS matching ([#32](https://github.com/yeahthisisrob/quicksight-portal/issues/32)) ([b664cc8](https://github.com/yeahthisisrob/quicksight-portal/commit/b664cc8426ff69da6850530bc4619a4fe7cb5f44))
* SMUS catalog links for datasets - indicator, view action, and filter ([#29](https://github.com/yeahthisisrob/quicksight-portal/issues/29)) ([82c174d](https://github.com/yeahthisisrob/quicksight-portal/commit/82c174dc5bac39880fc020d4dc8604442a9a2889))
* SMUS deploy config via cdk.context and datazone IAM permission ([#30](https://github.com/yeahthisisrob/quicksight-portal/issues/30)) ([c02e90e](https://github.com/yeahthisisrob/quicksight-portal/commit/c02e90e76d282cbe83a8bc574a5450b193b7cab8))
* split dataset source type into data source type + import mode, add schema column and import mode filter ([#33](https://github.com/yeahthisisrob/quicksight-portal/issues/33)) ([2552ccd](https://github.com/yeahthisisrob/quicksight-portal/commit/2552ccd638331a2369b5ffa44923b417a2f785ec))

## [1.6.0](https://github.com/yeahthisisrob/quicksight-portal/compare/v1.5.0...v1.6.0) (2026-08-17)


### Features

* redesign export assets page layout ([#27](https://github.com/yeahthisisrob/quicksight-portal/issues/27)) ([c6ba324](https://github.com/yeahthisisrob/quicksight-portal/commit/c6ba324d12e7aab2fc167651ddd4c4fa54aa5da1))

## [1.5.0](https://github.com/yeahthisisrob/quicksight-portal/compare/v1.4.0...v1.5.0) (2026-08-17)


### Features

* dataset activity - ingestion refresh history plus usage via dashboards/analyses ([#25](https://github.com/yeahthisisrob/quicksight-portal/issues/25)) ([4a0fd65](https://github.com/yeahthisisrob/quicksight-portal/commit/4a0fd65ecd5d577bc67bf831076352fbe7a8feae))

## [1.4.0](https://github.com/yeahthisisrob/quicksight-portal/compare/v1.3.0...v1.4.0) (2026-08-13)


### Features

* http caching with etags, group list memoization, persisted snapshots, react-query list cache ([#23](https://github.com/yeahthisisrob/quicksight-portal/issues/23)) ([fbae78b](https://github.com/yeahthisisrob/quicksight-portal/commit/fbae78b9d8c98e93b2890560d9cee6608bb50b96))

## [1.3.0](https://github.com/yeahthisisrob/quicksight-portal/compare/v1.2.5...v1.3.0) (2026-08-13)


### Features

* unified job history with type filter, fix API calls column ([#21](https://github.com/yeahthisisrob/quicksight-portal/issues/21)) ([852f241](https://github.com/yeahthisisrob/quicksight-portal/commit/852f241dbd0be589ffe9246b85aeffb50ef7a564))


### Bug Fixes

* extract analysis id/name from console UpdateAnalysis service events ([#17](https://github.com/yeahthisisrob/quicksight-portal/issues/17)) ([e459a11](https://github.com/yeahthisisrob/quicksight-portal/commit/e459a1176d681f52a5d5950de30af0c11fdf3aa1))
* force full activity rescan so pre-fix analysis events get ids and names ([#20](https://github.com/yeahthisisrob/quicksight-portal/issues/20)) ([29b9163](https://github.com/yeahthisisrob/quicksight-portal/commit/29b9163ef7099eb3eb336d3e040a3bc5b1075e9a))
* self-healing cache freshness and job recovery, remove manual clear buttons ([#19](https://github.com/yeahthisisrob/quicksight-portal/issues/19)) ([490d188](https://github.com/yeahthisisrob/quicksight-portal/commit/490d1883e2847d47d64dd89cb3d858ae329ea176))
* users tab performance - memoized enrichment, indexed access counts, single-flight cache reads ([#22](https://github.com/yeahthisisrob/quicksight-portal/issues/22)) ([0964a85](https://github.com/yeahthisisrob/quicksight-portal/commit/0964a8567f6e3804de0e78757e40c439621c49f3))

## [1.2.5](https://github.com/yeahthisisrob/quicksight-portal/compare/v1.2.4...v1.2.5) (2026-06-19)


### Bug Fixes

* confirm QuickSight creation before reporting restore success ([#15](https://github.com/yeahthisisrob/quicksight-portal/issues/15)) ([ca50034](https://github.com/yeahthisisrob/quicksight-portal/commit/ca500344c797ff591d2250c380ba4008aa14901a))

## [1.2.4](https://github.com/yeahthisisrob/quicksight-portal/compare/v1.2.3...v1.2.4) (2026-06-19)


### Bug Fixes

* revive ISO timestamps when restoring assets (AWS SDK epoch error) ([#13](https://github.com/yeahthisisrob/quicksight-portal/issues/13)) ([a836cfd](https://github.com/yeahthisisrob/quicksight-portal/commit/a836cfdc2aaafce5aca255e30f5d47c8d7aca964))

## [1.2.3](https://github.com/yeahthisisrob/quicksight-portal/compare/v1.2.2...v1.2.3) (2026-06-18)


### Bug Fixes

* make asset restore trustworthy and normalize dashboard permissions ([#11](https://github.com/yeahthisisrob/quicksight-portal/issues/11)) ([e0bb2f2](https://github.com/yeahthisisrob/quicksight-portal/commit/e0bb2f24c239ff15cfee15a61250f422fb87d768))

## [1.2.2](https://github.com/yeahthisisrob/quicksight-portal/compare/v1.2.1...v1.2.2) (2026-06-16)


### Bug Fixes

* **cache:** properly bust/update S3 index + memory on deletes & bulk mutations ([f5067a8](https://github.com/yeahthisisrob/quicksight-portal/commit/f5067a808a15d76e99bb73370a6ece2e0a2b9d7e))

## [1.2.1](https://github.com/yeahthisisrob/quicksight-portal/compare/v1.2.0...v1.2.1) (2026-06-11)


### Bug Fixes

* correct data catalog scope bands, All Fields tab, and physical table columns ([#7](https://github.com/yeahthisisrob/quicksight-portal/issues/7)) ([ce67ad0](https://github.com/yeahthisisrob/quicksight-portal/commit/ce67ad0e0cbcbe109ce2f70f46885c2ad1898c97))

## [1.2.0](https://github.com/yeahthisisrob/quicksight-portal/compare/v1.1.0...v1.2.0) (2026-06-10)


### Features

* rework data catalog with pre-computed index, conflict detection, and source scope ([#5](https://github.com/yeahthisisrob/quicksight-portal/issues/5)) ([c4377d8](https://github.com/yeahthisisrob/quicksight-portal/commit/c4377d846fb8be7f79a2359223a68f41f856cb9c))

## [1.1.0](https://github.com/yeahthisisrob/quicksight-portal/compare/v1.0.0...v1.1.0) (2026-05-06)


### Features

* optimize activity refresh + adopt release-please ([#3](https://github.com/yeahthisisrob/quicksight-portal/issues/3)) ([913f136](https://github.com/yeahthisisrob/quicksight-portal/commit/913f13654e12cd093992aac5509cca57458d6e56))

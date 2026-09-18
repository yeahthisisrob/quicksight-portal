# Changelog

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

# Changelog

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

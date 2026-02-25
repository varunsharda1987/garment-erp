// Re-export material master types - interfaces must use 'export type'
export type {
  MaterialMaster,
  MaterialSupplierMapping,
  CreateMaterialMasterDto,
  UpdateMaterialMasterDto,
  MaterialMasterFilterDto,
  MaterialSupplierMappingDto,
  LaceSpecifications,
  ButtonSpecifications,
  ThreadSpecifications,
  ZipperSpecifications,
  ElasticSpecifications,
  LabelSpecifications,
  PackagingSpecifications,
  MachinePartSpecifications,
  MaterialSpecifications,
} from './material-master.types';

// Re-export values (const objects) - these are runtime values
// MaterialType can be used as both value and type since it's defined with 'as const' pattern
export {
  MaterialType,
  MaterialTypeLabels,
  MaterialTypeCategories,
} from './material-master.types';

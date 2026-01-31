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
export {
  MaterialType,
  MaterialTypeLabels,
  MaterialTypeCategories,
} from './material-master.types';

// Re-export the MaterialType as a type as well (for type annotations)
export type { MaterialType } from './material-master.types';

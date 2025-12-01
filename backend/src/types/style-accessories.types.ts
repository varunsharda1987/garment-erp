// Style Accessories Types
// Garment and Packaging accessories for individual styles

export interface StyleGarmentAccessory {
  id: string;
  styleId: string;
  accessoryName: string;
  accessoryType?: string;
  specification?: string;
  quantityPerPiece?: number;
  isFromCustomer: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StylePackagingAccessory {
  id: string;
  styleId: string;
  itemName: string;
  itemType?: string;
  specification?: string;
  quantityPerPack?: number;
  isFromCustomer: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateStyleGarmentAccessoryDTO {
  accessoryName: string;
  accessoryType?: string;
  specification?: string;
  quantityPerPiece?: number;
  isFromCustomer?: boolean;
}

export interface CreateStylePackagingAccessoryDTO {
  itemName: string;
  itemType?: string;
  specification?: string;
  quantityPerPack?: number;
  isFromCustomer?: boolean;
}

export interface UpdateStyleGarmentAccessoryDTO {
  accessoryName?: string;
  accessoryType?: string;
  specification?: string;
  quantityPerPiece?: number;
}

export interface UpdateStylePackagingAccessoryDTO {
  itemName?: string;
  itemType?: string;
  specification?: string;
  quantityPerPack?: number;
}

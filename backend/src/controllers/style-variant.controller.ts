import { Request, Response } from 'express';
import StyleVariantService from '../services/style-variant.service';

class StyleVariantController {
  async getStyleVariants(req: Request, res: Response) {
    try {
      const { styleId } = req.params;
      const variants = await StyleVariantService.getStyleVariants(styleId);

      return res.status(200).json({
        success: true,
        data: variants,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  async getVariantBySKU(req: Request, res: Response) {
    try {
      const { sku } = req.params;
      const variant = await StyleVariantService.getVariantBySKU(sku);

      if (!variant) {
        return res.status(404).json({
          success: false,
          message: 'Variant not found',
        });
      }

      return res.status(200).json({
        success: true,
        data: variant,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
}

export default new StyleVariantController();

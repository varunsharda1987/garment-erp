import { Request, Response } from 'express';
import StyleVariantService from '../services/style-variant.service';
import { NotFoundError } from '../errors';

class StyleVariantController {
  async getStyleVariants(req: Request, res: Response) {
    const { styleId } = req.params;
    const variants = await StyleVariantService.getStyleVariants(styleId);

    res.status(200).json({
      success: true,
      data: variants,
    });
  }

  async getVariantBySKU(req: Request, res: Response) {
    const { sku } = req.params;
    const variant = await StyleVariantService.getVariantBySKU(sku);

    if (!variant) {
      throw new NotFoundError('Variant', sku);
    }

    res.status(200).json({
      success: true,
      data: variant,
    });
  }
}

export default new StyleVariantController();

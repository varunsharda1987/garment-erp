/**
 * Create Colourway — copy a style into a new colour (POST /styles/:id/colourways).
 *
 * A colourway is its own style: the copy takes the design (components, fabrics, trims, sizes, process,
 * spec, sketches) and the CAD work (unapproved), never the costing or the photo. A fabric in the style's
 * colour takes the new colour; any other fabric stays as it is — the same rule the server applies
 * (backend services/style-colourway.service.ts), shown here before anything is created.
 */
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ColorCombobox } from '@/components/ColorCombobox';
import { StyleIdentity } from '@/components/StyleIdentity';
import { styleService } from '@/services/style.service';
import { notify } from '@/lib/notify';
import { getErrorMessage } from '@/lib/api-error-handler';
import { BUYER_STYLE_CODE_LABEL, styleCodeLabel } from '@/lib/style-code';
import type { ColourwayCreated, Style, StyleColourway } from '@/types/style.types';

interface CreateColourwayDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  style: Style;
  /** The style's colour group, to warn when the picked colour is already one of them */
  colourways: StyleColourway[];
  onCreated: (created: ColourwayCreated) => void;
}

function Swatch({ hex }: { hex?: string | null }) {
  return (
    <span
      className="inline-block h-3 w-3 shrink-0 rounded-full border border-border"
      style={hex ? { backgroundColor: hex } : undefined}
    />
  );
}

export function CreateColourwayDialog({
  open,
  onOpenChange,
  style,
  colourways,
  onCreated,
}: CreateColourwayDialogProps) {
  // In-house brands type their buyer code AS the style code (LNG182P): then the new code is required and
  // becomes both. Everyone else gets a Style Code made like a new style's.
  const codeIsBuyerCode = !!style.buyerStyleRef && style.buyerStyleRef.trim() === style.styleCode.trim();
  const namedByCode = style.styleName.trim() === style.styleCode.trim();

  const [colorId, setColorId] = useState('');
  const [colour, setColour] = useState<{ name: string; hex: string | null } | null>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState(namedByCode ? '' : style.styleName);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setColorId('');
    setColour(null);
    setCode('');
    setName(namedByCode ? '' : style.styleName);
  };

  const sameAsSource = !!colorId && colorId === style.colorId;
  const alreadyInGroup = colourways.filter((c) => !c.isCurrent && c.colour?.id === colorId);
  const canSave = !!colorId && !sameAsSource && (!codeIsBuyerCode || code.trim() !== '') && !saving;

  const fabrics = (style.components ?? []).flatMap((comp) =>
    (comp.fabrics ?? []).map((fab) => ({ component: comp.componentName, fab }))
  );
  const recoloured = fabrics.filter(({ fab }) => !!style.colorId && fab.colorMaster?.id === style.colorId);
  const kept = fabrics.filter((f) => !recoloured.includes(f));

  const submit = async () => {
    if (!canSave) return;
    try {
      setSaving(true);
      const created = await styleService.createColourway(style.id, {
        colorId,
        buyerStyleRef: code.trim() || null,
        styleName: name.trim() || null,
      });
      notify.success(`Colourway ${styleCodeLabel(created)} created in ${created.colourName}`);
      reset();
      onCreated(created);
    } catch (err: unknown) {
      notify.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Colourway</DialogTitle>
          <DialogDescription>
            A new style copied from <StyleIdentity style={style} name={namedByCode ? null : style.styleName} /> in
            another colour.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>
              New Colour <span className="text-destructive">*</span>
            </Label>
            <ColorCombobox
              value={colorId}
              onValueChange={(id, picked) => {
                setColorId(id);
                setColour(picked ? { name: picked.colorName, hex: picked.hexCode ?? null } : null);
              }}
              placeholder="Select the new colour"
            />
            {style.color && (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Swatch hex={style.color.hexCode} /> This style is {style.color.colorName}
              </p>
            )}
            {sameAsSource && <p className="text-xs text-destructive">This style is already this colour.</p>}
            {alreadyInGroup.length > 0 && (
              <p className="text-xs text-warning">
                Already a colourway in this colour: {alreadyInGroup.map((c) => styleCodeLabel(c)).join(', ')}. You can
                still make another.
              </p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="colourway-code">
              {codeIsBuyerCode ? 'Style Code (also the Buyer Style Code)' : BUYER_STYLE_CODE_LABEL}
              {codeIsBuyerCode && <span className="text-destructive"> *</span>}
            </Label>
            <Input
              id="colourway-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={
                codeIsBuyerCode
                  ? `e.g. ${style.styleCode} with the colour letter changed`
                  : 'The buyer’s code for this colour'
              }
            />
            <p className="text-xs text-muted-foreground">
              {codeIsBuyerCode
                ? 'This brand uses its own code as the Style Code, so the new colourway needs one.'
                : 'Each colour usually has its own code from the buyer — leave it blank if there is none yet. Our Style Code is made automatically, like a new style’s.'}
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="colourway-name">Style Name</Label>
            <Input
              id="colourway-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Same as the new Style Code"
            />
          </div>

          {fabrics.length > 0 && (
            <div className="grid gap-2 rounded-md border border-border p-3 text-sm">
              <p className="font-medium">Fabrics</p>
              {recoloured.map(({ component, fab }) => (
                <div key={fab.id} className="flex items-center gap-2">
                  <Swatch hex={colour?.hex ?? null} />
                  <span>
                    {component} — {fab.fabricName}
                    {fab.hasEmbroidery ? ' (embroidered)' : ''}:{' '}
                    <span className="font-medium">
                      {fab.colorMaster?.colorName} → {colour?.name ?? 'the new colour'}
                    </span>
                  </span>
                </div>
              ))}
              {kept.map(({ component, fab }) => (
                <div key={fab.id} className="flex items-center gap-2 text-muted-foreground">
                  <Swatch hex={fab.colorMaster?.hexCode ?? null} />
                  <span>
                    {component} — {fab.fabricName}
                    {fab.hasEmbroidery ? ' (embroidered)' : ''}: stays{' '}
                    {fab.colorMaster?.colorName ?? fab.printDesign ?? 'as it is'}
                  </span>
                </div>
              ))}
            </div>
          )}

          <Alert>
            <AlertDescription className="text-xs space-y-1">
              <p>
                <span className="font-medium">Copied:</span> components, fabrics, trims (the same items, quantities and
                rates), sizes, processes, tech spec, sketches, and the CAD rows with their marker images — to approve
                again on the new style.
              </p>
              <p>
                <span className="font-medium">Not copied:</span> fabric costing and cost sheets (the dyeing rate can
                change with the shade), the product photo, samples, orders and stock.
              </p>
              <p>
                After creating, the new style opens in Edit Style — change any trim whose colour follows the garment
                (thread, elastic, lace, buttons) and any print design there.
              </p>
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!canSave}>
            {saving ? 'Creating…' : 'Create Colourway'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CreateColourwayDialog;

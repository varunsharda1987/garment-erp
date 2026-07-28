import { Smartphone, RefreshCw, CheckCircle2, Loader2, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useWhatsappStatus, useWhatsappConnect, useWhatsappDisconnect } from '@/hooks/useWhatsapp';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

/**
 * "My WhatsApp" — each user links THEIR OWN WhatsApp here by scanning a QR from their phone.
 * Everything they send from the app (staff messages, sample-courier alerts, documents) then
 * goes out through their own number.
 */
export default function WhatsAppLink() {
  const { data: status } = useWhatsappStatus();
  const connect = useWhatsappConnect();
  const disconnect = useWhatsappDisconnect();

  const state = status?.state ?? 'disconnected';

  const onConnect = async () => {
    try {
      await connect.mutateAsync();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to start WhatsApp');
    }
  };

  const onUnlink = async () => {
    try {
      await disconnect.mutateAsync();
      toast.success('WhatsApp unlinked');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to unlink');
    }
  };

  const statusBadge =
    state === 'ready' ? (
      <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Linked</Badge>
    ) : state === 'disconnected' ? (
      <Badge variant="secondary">Not linked</Badge>
    ) : (
      <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">Linking…</Badge>
    );

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <MessageCircle className="h-6 w-6 text-green-600" /> My WhatsApp
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Link your own WhatsApp here. Messages you send from the app go through your number.
          </p>
        </div>
        {statusBadge}
      </div>

      <Card>
        <CardContent className="space-y-5 p-6 text-center">
          {state === 'ready' ? (
            <div className="space-y-3">
              <CheckCircle2 className="mx-auto h-12 w-12 text-green-600" />
              <div>
                <div className="font-semibold">WhatsApp is linked</div>
                <div className="text-sm text-muted-foreground">
                  Connected{status?.me?.name ? ` as ${status.me.name}` : ''}
                  {status?.me?.number ? ` (+${status.me.number})` : ''}. You can now send messages and documents
                  straight to chats.
                </div>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" disabled={disconnect.isPending}>
                    Unlink this device
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Unlink your WhatsApp?</AlertDialogTitle>
                    <AlertDialogDescription>
                      You will need to scan a new QR code to send from your number again.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={onUnlink}>Unlink</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ) : state === 'qr' && status?.qr ? (
            <div className="space-y-3">
              <img src={status.qr} alt="WhatsApp QR code" className="mx-auto h-56 w-56 rounded border p-1" />
              <ol className="mx-auto max-w-sm space-y-1 text-left text-sm text-muted-foreground">
                <li>
                  1. Open <span className="font-medium">WhatsApp</span> on your phone.
                </li>
                <li>
                  2. Tap <span className="font-medium">Settings → Linked devices → Link a device</span>.
                </li>
                <li>3. Point the camera at this QR code to scan it.</li>
              </ol>
              <p className="text-xs text-muted-foreground">The code refreshes automatically while you scan.</p>
            </div>
          ) : state === 'initializing' || state === 'authenticated' ? (
            <div className="flex flex-col items-center gap-3 py-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                {state === 'authenticated'
                  ? 'Scanned — finishing sign-in…'
                  : 'Starting WhatsApp… the QR can take up to ~30s to appear.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <Smartphone className="mx-auto h-12 w-12 text-muted-foreground" />
              <div>
                <div className="font-semibold">WhatsApp isn’t linked</div>
                <div className="text-sm text-muted-foreground">
                  Generate a QR code, then scan it from your phone to connect your number.
                </div>
              </div>
              <Button onClick={onConnect} disabled={connect.isPending}>
                {connect.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Generate QR code
              </Button>
            </div>
          )}

          {(status?.error || status?.attention) && state !== 'ready' && (
            <p className="text-sm text-destructive">{status.error || status.attention}</p>
          )}
        </CardContent>
      </Card>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        On your phone: WhatsApp → Settings → Linked devices → Link a device → scan the QR above.
      </p>
    </div>
  );
}

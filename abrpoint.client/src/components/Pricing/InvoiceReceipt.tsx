import { Box, Paper, Stack, Typography } from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';

/**
 * Reçu détaillé « Détail de votre facture » — design variante B des maquettes
 * (cf. maquettes-abonnement.html). Présentation claire et sectionnée d'une facture :
 * abonnement de base, dépassement de sièges, modules optionnels, puis sous-total HT,
 * TVA et total TTC.
 *
 * Composant 100 % présentational : les montants et lignes sont fournis par le parent
 * (MonAbonnementPage le construit depuis /billing/subscription ; FacturesConcordePage
 * depuis la même source pour la facture à venir, ou depuis les agrégats Stripe pour
 * l'historique). Aucun calcul métier ici hormis sous-total → TVA → TTC.
 */

export type ReceiptLineKind = 'base' | 'over' | 'module';

export interface ReceiptLine {
  /** Libellé principal de la ligne (ex. « Pack Premium »). */
  label: string;
  /** Sous-libellé discret (ex. « 50 collaborateurs inclus · 21 fonctionnalités »). */
  sublabel?: string;
  /** Quantité affichée à droite au-dessus du prix (ex. « 52 actifs → 2 supp. »). */
  qty?: string;
  /** Montant HT en €. */
  amountEur: number;
  kind?: ReceiptLineKind;
}

export interface ReceiptSection {
  title: string;
  /** Pastille à droite du titre de section (ex. DÉPASSEMENT, +2 ACTIFS). */
  tag?: { label: string; kind: 'over' | 'module' };
  lines: ReceiptLine[];
}

interface InvoiceReceiptProps {
  title?: string;
  /** Pastille d'en-tête (ex. « Pack Premium · Engagement annuel »). */
  cycleLabel?: string;
  sections: ReceiptSection[];
  /** Sous-total HT (si omis, calculé à partir des lignes). */
  subtotalHt?: number;
  /** Taux de TVA (défaut 20 %). Ignoré si `tvaAmount` est fourni. */
  tvaRate?: number;
  /** Montant de TVA explicite (ex. valeur Stripe réelle). Prioritaire sur `tvaRate`. */
  tvaAmount?: number;
  /** Total TTC explicite (ex. valeur Stripe réelle). Prioritaire sur le calcul. */
  totalTtc?: number;
  /** Libellé du total (défaut « À payer / mois »). */
  totalLabel?: string;
}

const eur = (n: number) =>
  n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

const priceColor = (kind?: ReceiptLineKind) =>
  kind === 'over' ? '#E8870B' : kind === 'module' ? '#7C3AED' : '#0F1B33';

export default function InvoiceReceipt({
  title = 'Détail de votre facture',
  cycleLabel,
  sections,
  subtotalHt,
  tvaRate = 0.2,
  tvaAmount,
  totalTtc: totalTtcOverride,
  totalLabel = 'À payer / mois',
}: InvoiceReceiptProps) {
  const computedSubtotal = subtotalHt ?? sections.reduce(
    (s, sec) => s + sec.lines.reduce((ls, l) => ls + l.amountEur, 0),
    0,
  );
  const tva = tvaAmount ?? computedSubtotal * tvaRate;
  const totalTtc = totalTtcOverride ?? computedSubtotal + tva;

  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 2.5, md: 3.5 }, borderRadius: '18px', border: '1px solid #E4EAF3',
        boxShadow: '0 1px 2px rgba(20,52,107,.06), 0 12px 32px -16px rgba(20,52,107,.28)',
      }}
    >
      {/* En-tête : titre + pastille cycle */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1.5}>
        <Typography sx={{ fontSize: 18, fontWeight: 800, color: '#0F1B33' }}>{title}</Typography>
        {cycleLabel && (
          <Stack direction="row" alignItems="center" spacing={0.75} sx={{
            fontSize: 12, fontWeight: 700, color: '#14346B', bgcolor: '#EEF3FB',
            border: '1px solid #DCE6F6', px: 1.4, py: 0.6, borderRadius: '999px',
          }}>
            <CheckIcon sx={{ fontSize: 14 }} />
            <Box component="span">{cycleLabel}</Box>
          </Stack>
        )}
      </Stack>

      {/* Sections */}
      {sections.map((sec, si) => (
        <Box key={`${sec.title}-${si}`}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ pt: 2, pb: 0.5 }}>
            <Typography sx={{
              fontSize: 11.5, letterSpacing: '.1em', textTransform: 'uppercase',
              color: '#6A7691', fontWeight: 700,
            }}>
              {sec.title}
            </Typography>
            {sec.tag && (
              <Box component="span" sx={{
                fontSize: 11, fontWeight: 700, px: 1, py: '3px', borderRadius: '7px',
                bgcolor: sec.tag.kind === 'over' ? '#FCEFD9' : '#F3EEFE',
                color: sec.tag.kind === 'over' ? '#8a5208' : '#6d28d9',
              }}>
                {sec.tag.label}
              </Box>
            )}
          </Stack>
          {sec.lines.map((l, li) => (
            <Box
              key={`${l.label}-${li}`}
              sx={{
                display: 'grid', gridTemplateColumns: '1fr auto', gap: 1, alignItems: 'baseline',
                py: 1.3, borderBottom: '1px dashed #E4EAF3',
              }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontWeight: 600, fontSize: 14.5, color: '#0F1B33' }}>{l.label}</Typography>
                {l.sublabel && (
                  <Typography sx={{ fontSize: 12.5, color: '#6A7691', mt: 0.25 }}>{l.sublabel}</Typography>
                )}
              </Box>
              <Box sx={{ textAlign: 'right' }}>
                {l.qty && <Typography sx={{ fontSize: 12.5, color: '#6A7691' }}>{l.qty}</Typography>}
                <Typography sx={{ fontWeight: 700, fontSize: 15, fontVariantNumeric: 'tabular-nums', color: priceColor(l.kind) }}>
                  {eur(l.amountEur)}
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>
      ))}

      {/* Sous-total + TVA */}
      <Stack direction="row" justifyContent="space-between" sx={{ pt: 1.6, fontSize: 14, color: '#6A7691' }}>
        <Typography sx={{ fontSize: 14, color: '#6A7691' }}>Sous-total HT</Typography>
        <Typography sx={{ fontWeight: 700, color: '#0F1B33', fontVariantNumeric: 'tabular-nums' }}>{eur(computedSubtotal)}</Typography>
      </Stack>
      <Stack direction="row" justifyContent="space-between" sx={{ py: 1.3, fontSize: 14, color: '#6A7691' }}>
        <Typography sx={{ fontSize: 14, color: '#6A7691' }}>TVA {Math.round(tvaRate * 100)} %</Typography>
        <Typography sx={{ fontWeight: 700, color: '#0F1B33', fontVariantNumeric: 'tabular-nums' }}>{eur(tva)}</Typography>
      </Stack>

      {/* Total TTC */}
      <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{
        mt: 1, p: 2, borderRadius: '14px', bgcolor: '#EEF3FB', border: '1px solid #DCE6F6',
      }}>
        <Typography sx={{ fontWeight: 700, fontSize: 16, color: '#0F1B33' }}>{totalLabel}</Typography>
        <Typography sx={{ fontWeight: 800, fontSize: 26, color: '#14346B', fontVariantNumeric: 'tabular-nums' }}>
          {eur(totalTtc)} TTC
        </Typography>
      </Stack>
    </Paper>
  );
}

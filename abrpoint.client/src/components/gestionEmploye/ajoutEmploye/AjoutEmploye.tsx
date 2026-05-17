import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import './AjoutEmploye.css'
import EmployeDetails from '../EmployeDetails/EmployeDetails';
import { Button, IconButton, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions, DialogContentText, CircularProgress, Box as MuiBox } from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { useFeedbackSnackbar } from '../../helper/FeedbackSnackbar';
import { useContext, useEffect, useState } from 'react';
import dayjs from 'dayjs';
import { Item } from '../../helper/Item/Item';
import Employe from '../../../models/Employe';
import { EmployeeContext, EmployeeProvider } from '../../Pointeuse/EtatPeriodique/EmployeeContext';
import SaveIcon from '@mui/icons-material/Save';
import useAddEmploye from '../../../hooks/employeHooks/useAddEmploye';
import useUpdateEmploye from '../../../hooks/employeHooks/useUpdateEmploye';
import { useAuth } from '../../helper/AuthProvider';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import EmployeService from '../../../services/EmployeService/EmployeService';

export default function BasicGrid() {
  const { soccod, sitcod } = useAuth();
  const { t } = useTranslation();
  const feedback = useFeedbackSnackbar();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'save' | 'update'>('save');

  const { selectedEmp } = useContext(EmployeeContext);
  
  const getDefaultEmployeData = (): Employe => ({
    empcod: '',
    soccod: soccod || '',
    sitcod: sitcod || '',
    emplib: '',
    empmat: '',
    empsexe: '',
    sercod: '',
    empfonc: '',
    empelon: '',
    empreg: '',
    catcod: '',
    empnbp: 0,
    natcod: '',
    vilcod: '',
    empadr: '',
    empferepos: '',
    emptel: '',
    empmob: '',
    empemb: null,
    empsort: null,
    empmotif: '',
    actif: 'N',
    empdnais: '',
    emplnais: '',
    empcin: '',
    empdcin: null,
    empacin: '',
    empsbase: '',
    empsbrut: '',
    empdir: '',
    emptype: '',
    empniv: '',
    emplibar: '',
    empadrar: '',
    empfoncar: '',
    foncod: '',
    quacod: '',
    empmaxhre: 0,
    empoptim: null,
    dircod: '',
    empretraite: null,
    caltype: '',
    empmaxjour: 0,
    empretard: '0',
    empemail: '',
    empresp: '',
    empsnet: '',
    empcontrat: '',
    empsitfam: '',
    empech: '',
    empcat: '',
    empscat: '',
    empnuit: '',
    empminhjour: 0,
    emppanier: '',
    seccod: '',
    poscod: '',
    parmois: '',
  });

  const [employeData, setEmployeData] = useState<Employe>(getDefaultEmployeData());
  const [combinedData, setCombinedData] = useState<Employe>(getDefaultEmployeData());

  // Modal de confirmation "supplément payant" : ouvert quand le backend retourne
  // 402 avec code "employee_quota_exceeded" (quota inclus du pack atteint). L'admin
  // doit confirmer explicitement que le nouveau collaborateur sera facturé en
  // supplément avant que la requête soit re-soumise avec ?confirmOverage=true.
  const [overageDialog, setOverageDialog] = useState<{
    open: boolean;
    currentCount: number;
    includedMax: number;
    planName: string;
    overageRateEur: number;
    pendingEmploye: Employe | null;
  }>({
    open: false,
    currentCount: 0,
    includedMax: 0,
    planName: '',
    overageRateEur: 0,
    pendingEmploye: null,
  });
  const [overageSubmitting, setOverageSubmitting] = useState(false);

  // Dialog dédié quand le tenant est en essai gratuit et atteint le quota inclus
  // (code "trial_employee_limit_reached"). Pas d'opt-in payant possible en trial —
  // l'admin DOIT d'abord souscrire un plan payant. On lui propose un CTA direct
  // vers /dashboard/mon-abonnement (gestion plan + Stripe Checkout) plutôt qu'un
  // snackbar texte sans action.
  const [trialLimitDialog, setTrialLimitDialog] = useState<{
    open: boolean;
    currentCount: number;
    includedMax: number;
    planCode: string;
  }>({ open: false, currentCount: 0, includedMax: 0, planCode: '' });

  useEffect(() => {
    if (selectedEmp && selectedEmp.empcod) {
      setEmployeData(selectedEmp);
      setCombinedData(selectedEmp);
      setMode('update');
    } else if (!combinedData.empcod) {
      const defaultData = getDefaultEmployeData();
      setEmployeData(defaultData);
      setCombinedData(defaultData);
      setMode('save');
    }
  }, [selectedEmp]);

  const handleCombinedDataChange = (data: Employe) => {
    setCombinedData(data);
    setEmployeData(data);
  };
  const { mutate: addEmploye } = useAddEmploye();
  const { mutate: updateEmploye } = useUpdateEmploye();

  // Ancre la date à midi UTC pour empêcher les décalages de jour lors de la
  // sérialisation JSON (Date.toISOString convertit en UTC). Sans ça, en GMT+1
  // une saisie « 2026-05-04 » devient « 2026-05-03T23:00Z » → enregistrée en
  // base comme 2026-05-03 (la veille).
  const formatDate = (date: any): Date | null => {
    if (!date) return null;
    let y: number, m: number, d: number;
    if (date instanceof Date && !isNaN(date.getTime())) {
      y = date.getFullYear(); m = date.getMonth(); d = date.getDate();
    } else if (typeof date === 'string') {
      const parsedDate = dayjs(date);
      if (!parsedDate.isValid()) return null;
      y = parsedDate.year(); m = parsedDate.month(); d = parsedDate.date();
    } else {
      return null;
    }
    return new Date(Date.UTC(y, m, d, 12, 0, 0));
  };

  const saveEmp = () => {
    try {
      const employeToSave: Employe = {
        ...combinedData,
        soccod: soccod || '',
        sitcod: sitcod || '',
        empemb: formatDate(combinedData.empemb),
        empretraite: formatDate(combinedData.empretraite),
        empsort: formatDate(combinedData.empsort),
        empdcin: formatDate(combinedData.empdcin) || new Date(),
        empoptim: formatDate(combinedData.empoptim),
        actif: combinedData.actif,
      };

      addEmploye(employeToSave, {
        onSuccess: (res: any) => {
          feedback.showSuccess(res?.message || t('employe.addSuccess'));
        },
        onError: (error: any) => {
          // 402 + code "employee_quota_exceeded" = quota inclus atteint sur un
          // plan payant. On ouvre le modal d'opt-in plutôt que de remonter une
          // erreur — l'admin choisit consciemment de payer le supplément.
          const data = error?.response?.data;
          if (error?.response?.status === 402 && data?.code === 'employee_quota_exceeded') {
            setOverageDialog({
              open: true,
              currentCount: data.currentCount ?? 0,
              includedMax: data.includedMax ?? 0,
              planName: data.planName ?? data.planCode ?? 'votre pack',
              overageRateEur: data.overageRateEur ?? 0,
              pendingEmploye: employeToSave,
            });
            return;
          }
          // 402 + code "trial_employee_limit_reached" = même quota dur, mais en
          // essai gratuit. Pas de bypass possible : l'admin doit basculer en
          // payant avant. Dialog dédié avec CTA vers /dashboard/mon-abonnement.
          if (error?.response?.status === 402 && data?.code === 'trial_employee_limit_reached') {
            setTrialLimitDialog({
              open: true,
              currentCount: data.currentCount ?? 0,
              includedMax: data.includedMax ?? 0,
              planCode: data.planCode ?? '',
            });
            return;
          }
          console.error('Error saving employee:', error);
          feedback.showError(error, t('employe.addError'));
        },
      });
    } catch (error) {
      console.error('Error preparing employee data:', error);
      feedback.showError(error, t('employe.prepareError'));
    }
  };

  // Confirmation de l'opt-in : re-soumet la création du collab avec
  // ?confirmOverage=true. Le backend (EmployesController.Post) accepte, crée le
  // collab, puis pousse +1 sur l'item Stripe user_supp (facturation au prochain
  // cycle, prorata immédiat).
  const confirmOverageAndSave = async () => {
    if (!overageDialog.pendingEmploye) return;
    setOverageSubmitting(true);
    try {
      const res: any = await EmployeService.postWithQuery(
        overageDialog.pendingEmploye,
        { confirmOverage: true }
      );
      feedback.showSuccess(res?.message || t('employe.addSuccess'));
      setOverageDialog((d) => ({ ...d, open: false, pendingEmploye: null }));
    } catch (error: any) {
      console.error('Error confirming overage:', error);
      feedback.showError(error, t('employe.addError'));
    } finally {
      setOverageSubmitting(false);
    }
  };

  const updateEmp = () => {
    try {
      const employeToUpdate: Employe = {
        ...combinedData,
        soccod: soccod || '',
        sitcod: sitcod || '',
        actif: combinedData.actif,
        empemb: formatDate(combinedData.empemb),
        empretraite: formatDate(combinedData.empretraite),
        empsort: formatDate(combinedData.empsort),
        empdcin: formatDate(combinedData.empdcin),
        empoptim: formatDate(combinedData.empoptim),
      };

      updateEmploye(employeToUpdate, {
        onSuccess: (res: any) => {
          feedback.showSuccess(res?.message || t('employe.updateSuccess'));
        },
        onError: (error: any) => {
          console.error('Error updating employee:', error);
          feedback.showError(error, t('employe.updateError'));
        },
      });
    } catch (error) {
      console.error('Error preparing employee update data:', error);
      feedback.showError(error, 'Erreur lors de la préparation des données');
    }
  };
  return (
    <EmployeeProvider>
        <Box sx={{ flexGrow: 1 }} maxWidth={'97vw'} mt={-2} height={'55vh'}>
          <Grid item sx={{ float: 'right' }} position={'fixed'} top={60} right={0}>
            <Tooltip title={mode === 'save' ? t('employe.save') : t('employe.update')}>
              <IconButton color="primary" onClick={mode === 'save' ? saveEmp : updateEmp}>
                <Button
                  variant="contained"
                  color="primary"
                  component="span"
                  startIcon={<SaveIcon />}
                >
                </Button>
              </IconButton>
            </Tooltip>
          </Grid>
          <Grid container spacing={1}>
            <Grid item xs={12} maxHeight={50}>
              <Item>
                <EmployeDetails 
                  onCombinedDataChange={handleCombinedDataChange}
                  empData={employeData} 
                />
              </Item>
            </Grid>
          </Grid>
          {feedback.element}

          {/* Modal opt-in : quota inclus du pack atteint, l'admin choisit de
              facturer un collab supplémentaire via le produit Stripe user_supp. */}
          <Dialog
            open={overageDialog.open}
            onClose={() => !overageSubmitting && setOverageDialog((d) => ({ ...d, open: false, pendingEmploye: null }))}
            maxWidth="sm"
            fullWidth
          >
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <WarningAmberIcon sx={{ color: '#f59e0b' }} />
              Collaborateur supplémentaire — facturation
            </DialogTitle>
            <DialogContent>
              <DialogContentText component="div">
                <MuiBox sx={{ mb: 2 }}>
                  Vous avez atteint le quota de <strong>{overageDialog.includedMax} collaborateurs</strong>
                  {' '}inclus dans le pack <strong>{overageDialog.planName}</strong>
                  {' '}({overageDialog.currentCount} actuellement actifs).
                </MuiBox>
                <MuiBox sx={{ mb: 2, p: 2, bgcolor: '#fef3c7', border: '1px solid #fde68a', borderRadius: 1.5 }}>
                  Confirmer l'ajout de ce collaborateur facturera
                  {' '}<strong>{overageDialog.overageRateEur.toFixed(2)} € HT / mois</strong>
                  {' '}en supplément (article <code>user_supp</code> sur votre abonnement Stripe).
                  Une proration sera appliquée sur votre prochaine facture.
                </MuiBox>
                <MuiBox sx={{ fontSize: 13, color: '#64748b' }}>
                  Le montant s'ajoute automatiquement à votre abonnement existant ; aucun débit immédiat.
                  Vous pouvez désactiver ce collaborateur à tout moment, le supplément sera retiré au prochain cycle.
                </MuiBox>
              </DialogContentText>
            </DialogContent>
            <DialogActions sx={{ p: 2 }}>
              <Button
                onClick={() => setOverageDialog((d) => ({ ...d, open: false, pendingEmploye: null }))}
                disabled={overageSubmitting}
              >
                Annuler
              </Button>
              <Button
                variant="contained"
                color="primary"
                onClick={confirmOverageAndSave}
                disabled={overageSubmitting}
                startIcon={overageSubmitting ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : undefined}
              >
                Confirmer et facturer le supplément
              </Button>
            </DialogActions>
          </Dialog>

          {/* Dialog quota essai gratuit atteint — pas d'opt-in possible, CTA direct
              vers la page Mon abonnement (admin choisit un plan + Stripe Checkout). */}
          <Dialog
            open={trialLimitDialog.open}
            onClose={() => setTrialLimitDialog((d) => ({ ...d, open: false }))}
            maxWidth="sm"
            fullWidth
          >
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <WarningAmberIcon sx={{ color: '#f59e0b' }} />
              Limite de l'essai gratuit atteinte
            </DialogTitle>
            <DialogContent>
              <DialogContentText component="div">
                <MuiBox sx={{ mb: 2 }}>
                  Vous avez atteint le quota de <strong>{trialLimitDialog.includedMax} collaborateurs</strong>
                  {' '}inclus dans l'essai gratuit ({trialLimitDialog.currentCount} actuellement actifs).
                </MuiBox>
                <MuiBox sx={{ mb: 2, p: 2, bgcolor: '#dbeafe', border: '1px solid #93c5fd', borderRadius: 1.5 }}>
                  Pour ajouter des collaborateurs supplémentaires, souscrivez à un plan payant
                  (<strong>Starter / Standard / Premium</strong>). Vous serez ensuite débité à l'unité
                  pour chaque collaborateur au-delà du quota inclus de votre pack.
                </MuiBox>
                <MuiBox sx={{ fontSize: 13, color: '#64748b' }}>
                  L'essai gratuit reste actif jusqu'à votre passage au paiement —
                  aucune donnée n'est perdue.
                </MuiBox>
              </DialogContentText>
            </DialogContent>
            <DialogActions sx={{ p: 2 }}>
              <Button onClick={() => setTrialLimitDialog((d) => ({ ...d, open: false }))}>
                Plus tard
              </Button>
              <Button
                variant="contained"
                color="primary"
                onClick={() => {
                  setTrialLimitDialog((d) => ({ ...d, open: false }));
                  navigate('/dashboard/mon-abonnement');
                }}
              >
                Passer à un plan payant
              </Button>
            </DialogActions>
          </Dialog>
        </Box>
      </EmployeeProvider>
  );
}

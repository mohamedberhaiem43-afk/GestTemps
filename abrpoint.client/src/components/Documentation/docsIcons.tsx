import React from 'react';
import type { SvgIconProps } from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import SmartphoneIcon from '@mui/icons-material/Smartphone';
import FingerprintIcon from '@mui/icons-material/Fingerprint';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import ShieldIcon from '@mui/icons-material/Shield';
import ApartmentIcon from '@mui/icons-material/Apartment';
import GroupsIcon from '@mui/icons-material/Groups';
import ScheduleIcon from '@mui/icons-material/Schedule';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import PaymentsIcon from '@mui/icons-material/Payments';
import GppGoodIcon from '@mui/icons-material/GppGood';
import MenuBookIcon from '@mui/icons-material/MenuBook';

// Résout le nom d'icône (string, défini dans docsContent → langue-neutre) vers un
// composant MUI. Garder cette table synchronisée avec DOC_ARTICLES_META.icon.
const ICONS: Record<string, React.ComponentType<SvgIconProps>> = {
  home: HomeIcon,
  smartphone: SmartphoneIcon,
  fingerprint: FingerprintIcon,
  calendar: EventAvailableIcon,
  wallet: AccountBalanceWalletIcon,
  shield: ShieldIcon,
  building: ApartmentIcon,
  users: GroupsIcon,
  schedule: ScheduleIcon,
  key: VpnKeyIcon,
  checklist: FactCheckIcon,
  payments: PaymentsIcon,
  shieldcheck: GppGoodIcon,
};

export function DocIcon({ name, ...props }: { name: string } & SvgIconProps) {
  const Cmp = ICONS[name] ?? MenuBookIcon;
  return <Cmp {...props} />;
}

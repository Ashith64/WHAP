// src/constants/categories.js
import {
  ShoppingBag,
  Wrench,
  Package,
  Sparkles,
  Laptop,
  Printer,
  Users,
  Briefcase,
} from 'lucide-react';

export const TASK_CATEGORIES = [
  {
    key: 'ERRANDS_DELIVERY',
    label: 'Errands & Delivery',
    shortLabel: 'Errands',
    description: 'Groceries, parcels, pharmacy, local pickups',
    icon: ShoppingBag,
    color: 'text-emerald-600',
    markerBg: '#059669',
    border: 'hover:border-emerald-400',
    selectedBg: 'bg-emerald-50 border-emerald-600 ring-2 ring-emerald-500/20',
  },
  {
    key: 'HOME_REPAIRS',
    label: 'Home & Repairs',
    shortLabel: 'Repairs',
    description: 'Plumbing, electrical, assembly, handyman fixes',
    icon: Wrench,
    color: 'text-orange-600',
    markerBg: '#ea580c',
    border: 'hover:border-orange-400',
    selectedBg: 'bg-orange-50 border-orange-600 ring-2 ring-orange-500/20',
  },
  {
    key: 'MOVING_LIFTING',
    label: 'Moving & Lifting',
    shortLabel: 'Moving',
    description: 'Furniture shifting, boxes, heavy lifting help',
    icon: Package,
    color: 'text-amber-600',
    markerBg: '#d97706',
    border: 'hover:border-amber-400',
    selectedBg: 'bg-amber-50 border-amber-600 ring-2 ring-amber-500/20',
  },
  {
    key: 'CLEANING_CHORES',
    label: 'Cleaning & Chores',
    shortLabel: 'Cleaning',
    description: 'Room cleanup, yard work, organizing, washing',
    icon: Sparkles,
    color: 'text-cyan-600',
    markerBg: '#0891b2',
    border: 'hover:border-cyan-400',
    selectedBg: 'bg-cyan-50 border-cyan-600 ring-2 ring-cyan-500/20',
  },
  {
    key: 'TECH_SETUP',
    label: 'Tech & Setup',
    shortLabel: 'Tech',
    description: 'Wi-Fi setup, PC help, smart TV, device support',
    icon: Laptop,
    color: 'text-blue-600',
    markerBg: '#2563eb',
    border: 'hover:border-blue-400',
    selectedBg: 'bg-blue-50 border-blue-600 ring-2 ring-blue-500/20',
  },
  {
    key: 'PRINT_DOCUMENTS',
    label: 'Print & Documents',
    shortLabel: 'Print & Docs',
    description: 'Printing, scanning, document drop-off',
    icon: Printer,
    color: 'text-indigo-600',
    markerBg: '#4f46e5',
    border: 'hover:border-indigo-400',
    selectedBg: 'bg-indigo-50 border-indigo-600 ring-2 ring-indigo-500/20',
  },
  {
    key: 'QUEUE_WAITING',
    label: 'Queue & Waiting',
    shortLabel: 'Queue',
    description: 'Line standing, ticket collection, desk errands',
    icon: Users,
    color: 'text-violet-600',
    markerBg: '#7c3aed',
    border: 'hover:border-violet-400',
    selectedBg: 'bg-violet-50 border-violet-600 ring-2 ring-violet-500/20',
  },
  {
    key: 'OTHER',
    label: 'Any Other Work',
    shortLabel: 'Other',
    description: 'Custom local tasks, events, general help',
    icon: Briefcase,
    color: 'text-slate-700',
    markerBg: '#334155',
    border: 'hover:border-slate-400',
    selectedBg: 'bg-slate-50 border-slate-700 ring-2 ring-slate-500/20',
  },
];

const LEGACY_ALIASES = {
  BUY_ITEMS: 'ERRANDS_DELIVERY',
  CARRY_THINGS: 'MOVING_LIFTING',
  XEROX_PICKUP: 'PRINT_DOCUMENTS',
  QUEUE: 'QUEUE_WAITING',
};

export function getCategoryMeta(categoryKey) {
  const mappedKey = LEGACY_ALIASES[categoryKey] || categoryKey;
  return (
    TASK_CATEGORIES.find((c) => c.key === mappedKey) ||
    TASK_CATEGORIES[TASK_CATEGORIES.length - 1]
  );
}

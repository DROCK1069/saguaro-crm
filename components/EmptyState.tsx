'use client';

import React from 'react';
import {
  FolderOpen,
  Receipt,
  CurrencyDollar,
  Question,
  ArrowsClockwise,
  ImageSquare,
  Notebook,
  Gavel,
  FileText,
  Files,
  Plus,
  type Icon,
} from '@phosphor-icons/react';
import { colors, space, radius, shadow, font } from '../lib/design-tokens';

/* ────────────────────────── Icons ────────────────────────── */

const FolderIcon: Icon = FolderOpen;
const InvoiceIcon: Icon = Receipt;
const PayAppIcon: Icon = CurrencyDollar;
const RFIIcon: Icon = Question;
const ChangeOrderIcon: Icon = ArrowsClockwise;
const PhotoIcon: Icon = ImageSquare;
const DailyLogIcon: Icon = Notebook;
const BidIcon: Icon = Gavel;
const ContractIcon: Icon = FileText;
const SubmittalIcon: Icon = Files;

/* ────────────────────────── EmptyState ────────────────────────── */

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
}: EmptyStateProps) {
  const handleClick = () => {
    if (onAction) {
      onAction();
    } else if (actionHref) {
      window.location.href = actionHref;
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: `${space['5xl']}px ${space.xxl}px`,
        textAlign: 'center',
        background: colors.raised,
        borderRadius: radius['2xl'] + 2,
        border: `1px solid ${colors.border}`,
        boxShadow: shadow.sm,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 72,
          height: 72,
          marginBottom: space.xl,
          borderRadius: radius.full,
          background: colors.goldDim,
          border: `1px solid ${colors.goldBorder}`,
          color: colors.gold,
        }}
      >
        {icon ?? <FolderIcon size={32} weight="duotone" />}
      </div>

      <h3
        style={{
          margin: `0 0 ${space.sm}px`,
          fontSize: font.size['2xl'],
          fontWeight: font.weight.bold,
          letterSpacing: '-0.01em',
          color: colors.text,
        }}
      >
        {title}
      </h3>

      <p
        style={{
          margin: `0 0 ${space.xxl}px`,
          fontSize: font.size.lg,
          color: colors.textMuted,
          maxWidth: 400,
          lineHeight: 1.55,
        }}
      >
        {description}
      </p>

      {actionLabel && (
        <button
          onClick={handleClick}
          className="btn-gold"
          style={{
            fontSize: font.size.lg,
            padding: `10px ${space.xl}px`,
            cursor: 'pointer',
          }}
        >
          <Plus size={16} weight="bold" color="currentColor" />
          {actionLabel}
        </button>
      )}
    </div>
  );
}

/* ────────────────────────── Pre-built variants ────────────────────────── */

interface VariantProps {
  actionHref?: string;
  onAction?: () => void;
}

export function EmptyInvoices({ actionHref, onAction }: VariantProps) {
  return (
    <EmptyState
      icon={<InvoiceIcon size={32} weight="duotone" />}
      title="No invoices yet"
      description="Create your first invoice to start tracking payments and billing for this project."
      actionLabel="Create Invoice"
      actionHref={actionHref}
      onAction={onAction}
    />
  );
}

export function EmptyPayApps({ actionHref, onAction }: VariantProps) {
  return (
    <EmptyState
      icon={<PayAppIcon size={32} weight="duotone" />}
      title="No pay applications"
      description="Submit your first pay application to begin the payment request process with the owner."
      actionLabel="New Pay App"
      actionHref={actionHref}
      onAction={onAction}
    />
  );
}

export function EmptyRFIs({ actionHref, onAction }: VariantProps) {
  return (
    <EmptyState
      icon={<RFIIcon size={32} weight="duotone" />}
      title="No RFIs submitted"
      description="Create a Request for Information when you need clarification on plans, specs, or project details."
      actionLabel="Create RFI"
      actionHref={actionHref}
      onAction={onAction}
    />
  );
}

export function EmptyChangeOrders({ actionHref, onAction }: VariantProps) {
  return (
    <EmptyState
      icon={<ChangeOrderIcon size={32} weight="duotone" />}
      title="No change orders"
      description="Change orders will appear here when scope, cost, or schedule modifications are proposed."
      actionLabel="New Change Order"
      actionHref={actionHref}
      onAction={onAction}
    />
  );
}

export function EmptyPhotos({ actionHref, onAction }: VariantProps) {
  return (
    <EmptyState
      icon={<PhotoIcon size={32} weight="duotone" />}
      title="No photos uploaded"
      description="Upload progress photos to document the project timeline and share visual updates with stakeholders."
      actionLabel="Upload Photos"
      actionHref={actionHref}
      onAction={onAction}
    />
  );
}

export function EmptyDailyLogs({ actionHref, onAction }: VariantProps) {
  return (
    <EmptyState
      icon={<DailyLogIcon size={32} weight="duotone" />}
      title="No daily logs"
      description="Start logging daily field activities including weather, labor, equipment, and work completed."
      actionLabel="New Daily Log"
      actionHref={actionHref}
      onAction={onAction}
    />
  );
}

export function EmptyBids({ actionHref, onAction }: VariantProps) {
  return (
    <EmptyState
      icon={<BidIcon size={32} weight="duotone" />}
      title="No bids received"
      description="Bid submissions from subcontractors and vendors will appear here once bid packages are published."
      actionLabel="Create Bid Package"
      actionHref={actionHref}
      onAction={onAction}
    />
  );
}

export function EmptyContracts({ actionHref, onAction }: VariantProps) {
  return (
    <EmptyState
      icon={<ContractIcon size={32} weight="duotone" />}
      title="No contracts created"
      description="Create contracts to define scope, pricing, and terms with subcontractors and suppliers."
      actionLabel="New Contract"
      actionHref={actionHref}
      onAction={onAction}
    />
  );
}

export function EmptySubmittals({ actionHref, onAction }: VariantProps) {
  return (
    <EmptyState
      icon={<SubmittalIcon size={32} weight="duotone" />}
      title="No submittals"
      description="Track shop drawings, product data, and material samples submitted for approval by the design team."
      actionLabel="New Submittal"
      actionHref={actionHref}
      onAction={onAction}
    />
  );
}

export default EmptyState;

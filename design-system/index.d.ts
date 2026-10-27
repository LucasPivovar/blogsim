import * as React from 'react';

export type Objective = 'visitas' | 'conversas' | 'vendas';
export type Role = 'admin' | 'anunciante' | 'blogueiro';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** primary: ação principal · accent: gasta dinheiro (Alugar espaço) · secondary · ghost */
  variant?: 'primary' | 'accent' | 'secondary' | 'ghost';
  size?: 'md' | 'sm';
  /** Mostra o spinner e desabilita o botão. */
  loading?: boolean;
}

export interface BadgeProps {
  tone?: 'neutral' | 'brand' | 'accent' | 'teal' | 'success' | 'warning' | 'danger';
  /** Ponto antes do texto, para status. */
  dot?: boolean;
  children: React.ReactNode;
}

export interface TextFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  label: string;
  hint?: string;
  /** Mensagem de erro; substitui a dica e marca o campo como inválido. */
  error?: string;
  /** Ex.: "R$" */
  prefix?: string;
  /** Ex.: "/dia" */
  suffix?: string;
}

export interface MetricCardProps {
  label: string;
  value: number | string;
  /** money: R$ 1.240,00 · count: 18.430 */
  format?: 'money' | 'count';
  /** Variação em %, ex.: 12.4 ou -6 */
  delta?: number;
  /** true para custos: cair é bom. */
  invertDelta?: boolean;
  /** Ex.: "vs. 7 dias anteriores" */
  hint?: string;
  /** Série para o sparkline. */
  spark?: number[];
}

export interface ObjectivePickerProps {
  value?: Objective;
  defaultValue?: Objective;
  onChange?: (value: Objective) => void;
  label?: string;
}

export interface SlotCardProps {
  blog: string;
  niche?: string;
  placement: 'popup' | 'lateral' | 'banner' | 'inline';
  /** Leitores por mês. */
  audience?: number;
  /** Preço em reais por período. */
  price: number;
  period?: string;
  selected?: boolean;
  defaultSelected?: boolean;
  onToggle?: (selected: boolean) => void;
}

export interface CampaignRow {
  id?: string;
  name: string;
  objective: Objective;
  status: 'ativa' | 'pausada' | 'revisao' | 'encerrada';
  invested: number;
  clicks: number;
  results: number;
  blogs?: number;
  /** Nomes dos blogs onde a campanha aparece; substituem a contagem na tabela. */
  blogNames?: string[];
}

export interface CampaignTableProps {
  rows: CampaignRow[];
  emptyText?: string;
}

export interface SideNavProps {
  role: Role;
  items?: string[];
  active?: string;
  onNavigate?: (item: string) => void;
  /** Com esta função, o chip de perfil vira um seletor para trocar de perfil. */
  onRoleChange?: (role: Role) => void;
  user?: string;
  /** Mostra o botão Sair ao lado do usuário. */
  onLogout?: () => void;
}

export declare const Button: React.FC<ButtonProps>;
export declare const Badge: React.FC<BadgeProps>;
export declare const TextField: React.FC<TextFieldProps>;
export declare const MetricCard: React.FC<MetricCardProps>;
export declare const ObjectivePicker: React.FC<ObjectivePickerProps>;
export declare const SlotCard: React.FC<SlotCardProps>;
export declare const CampaignTable: React.FC<CampaignTableProps>;
export declare const SideNav: React.FC<SideNavProps>;
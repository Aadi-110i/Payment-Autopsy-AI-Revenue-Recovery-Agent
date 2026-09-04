import { ReactNode } from 'react';
import { cn } from '../utils/cn';
import type { RecoveryCase } from '../types';

interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (item: T) => string;
  emptyMessage?: string;
  className?: string;
  rowClassName?: (item: T) => string;
  onRowClick?: (item: T) => void;
}

export function DataTable<T>({ 
  data, 
  columns, 
  keyExtractor, 
  emptyMessage = 'No data available',
  className,
  rowClassName,
  onRowClick
}: DataTableProps<T>) {
  if (data.length === 0) {
    return (
      <div className={cn('card py-12 text-center', className)}>
        <p className="text-autopsy-text-muted">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={cn('table-container', className)}>
      <table className="table" role="table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} className={cn(column.className)}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr 
              key={keyExtractor(item)} 
              className={cn(rowClassName?.(item), onRowClick && 'cursor-pointer')}
              onClick={() => onRowClick?.(item)}
            >
              {columns.map((column) => (
                <td key={column.key} className={cn(column.className)}>
                  {column.render ? column.render(item) : String((item as any)[column.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Recovery Cases specific table
export function RecoveryCasesTable({ 
  cases, 
  onRowClick 
}: { 
  cases: RecoveryCase[]; 
  onRowClick?: (caseItem: RecoveryCase) => void;
}) {
  const columns = [
    {
      key: 'paymentId',
      header: 'Payment ID',
      render: (c: RecoveryCase) => (
        <code className="font-mono text-sm">{c.paymentId}</code>
      )
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (c: RecoveryCase) => (
        <span className="font-mono tabular-nums">{formatCurrency(c.amount)}</span>
      ),
      className: 'text-right'
    },
    {
      key: 'failureCategory',
      header: 'Failure',
      render: (c: RecoveryCase) => (
        <FailureCategoryBadge category={c.failureCategory || 'unknown'} />
      )
    },
    {
      key: 'recoverabilityScore',
      header: 'Recoverability',
      render: (c: RecoveryCase) => (
        <RecoverabilityBadge score={c.recoverabilityScore || 0} />
      ),
      className: 'hidden md:table-cell'
    },
    {
      key: 'status',
      header: 'Status',
      render: (c: RecoveryCase) => <StatusBadge status={c.status} />
    },
    {
      key: 'createdAt',
      header: 'Created',
      render: (c: RecoveryCase) => (
        <span className="text-autopsy-text-muted text-sm">{formatRelativeTime(c.createdAt)}</span>
      )
    }
  ];

  return (
    <DataTable
      data={cases}
      columns={columns}
      keyExtractor={(c) => c.id}
      onRowClick={onRowClick}
      emptyMessage="No recovery cases found"
    />
  );
}

// Import formatters
import { formatCurrency, formatRelativeTime } from '../utils/cn';
import { StatusBadge, FailureCategoryBadge, RecoverabilityBadge } from './Badges';
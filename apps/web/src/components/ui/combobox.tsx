"use client";

import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Command as CommandPrimitive } from "cmdk";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ComboboxOption {
  value: string;
  label: string;
  /** Extra text cmdk matches against but never renders — e.g. a country's alternate spellings. */
  keywords?: string[];
}

export interface ComboboxGroup {
  heading: string;
  options: ComboboxOption[];
}

type ComboboxItems = ComboboxOption[] | ComboboxGroup[];

function isGrouped(items: ComboboxItems): items is ComboboxGroup[] {
  const first = items[0];
  return first !== undefined && "options" in first;
}

function flattenOptions(items: ComboboxItems): ComboboxOption[] {
  return isGrouped(items) ? items.flatMap((group) => group.options) : items;
}

interface BaseProps {
  options: ComboboxItems;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
  "aria-invalid"?: boolean;
}

interface SingleComboboxProps extends BaseProps {
  multiple?: false;
  value: string | undefined;
  onChange: (value: string) => void;
}

interface MultiComboboxProps extends BaseProps {
  multiple: true;
  value: string[];
  onChange: (value: string[]) => void;
}

export type ComboboxProps = SingleComboboxProps | MultiComboboxProps;

/**
 * Searchable single/multi-select dropdown built on cmdk + Radix Popover
 * (both already dependencies, previously only used inside the Cmd+K
 * command palette). Styled to match select.tsx/command-palette.tsx
 * exactly (bg-popover, border-border, focus:bg-secondary) so it's
 * automatically correct in dark and light mode via the existing
 * CSS-variable token system.
 */
export function Combobox(props: ComboboxProps) {
  const {
    options,
    placeholder = "Select...",
    searchPlaceholder = "Search...",
    emptyText = "No results found.",
    disabled,
    className,
  } = props;
  const [open, setOpen] = React.useState(false);
  const flatOptions = React.useMemo(() => flattenOptions(options), [options]);

  const selectedValues = props.multiple ? props.value : props.value ? [props.value] : [];
  const selectedLabels = flatOptions
    .filter((option) => selectedValues.includes(option.value))
    .map((option) => option.label);

  function handleSelect(optionValue: string) {
    if (props.multiple) {
      const next = props.value.includes(optionValue)
        ? props.value.filter((v) => v !== optionValue)
        : [...props.value, optionValue];
      props.onChange(next);
      return;
    }
    props.onChange(optionValue);
    setOpen(false);
  }

  const triggerLabel =
    selectedLabels.length === 0
      ? placeholder
      : props.multiple
        ? `${selectedLabels.length} selected`
        : selectedLabels[0];

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          disabled={disabled}
          data-invalid={props["aria-invalid"] || undefined}
          aria-expanded={open}
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[invalid=true]:border-destructive",
            selectedLabels.length === 0 && "text-muted-foreground",
            className,
          )}
        >
          <span className="truncate">{triggerLabel}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={4}
          className="z-50 w-[var(--radix-popover-trigger-width)] overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95"
        >
          <CommandPrimitive
            className="flex h-full w-full flex-col overflow-hidden bg-transparent"
            filter={(value, search, keywords) => {
              const haystack = `${value} ${keywords?.join(" ") ?? ""}`.toLowerCase();
              return haystack.includes(search.toLowerCase()) ? 1 : 0;
            }}
          >
            <div className="flex items-center gap-2 border-b border-border px-3">
              <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <CommandPrimitive.Input
                autoFocus
                placeholder={searchPlaceholder}
                className="flex h-10 w-full bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            <CommandPrimitive.List className="max-h-64 overflow-y-auto p-1">
              <CommandPrimitive.Empty className="py-6 text-center text-sm text-muted-foreground">
                {emptyText}
              </CommandPrimitive.Empty>
              {isGrouped(options)
                ? options.map((group) => (
                    <CommandPrimitive.Group
                      key={group.heading}
                      heading={group.heading}
                      className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
                    >
                      {group.options.map((option) => (
                        <ComboboxItem
                          key={option.value}
                          option={option}
                          selected={selectedValues.includes(option.value)}
                          onSelect={handleSelect}
                        />
                      ))}
                    </CommandPrimitive.Group>
                  ))
                : options.map((option) => (
                    <ComboboxItem
                      key={option.value}
                      option={option}
                      selected={selectedValues.includes(option.value)}
                      onSelect={handleSelect}
                    />
                  ))}
            </CommandPrimitive.List>
          </CommandPrimitive>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

function ComboboxItem({
  option,
  selected,
  onSelect,
}: {
  option: ComboboxOption;
  selected: boolean;
  onSelect: (value: string) => void;
}) {
  return (
    <CommandPrimitive.Item
      value={option.label}
      keywords={option.keywords}
      onSelect={() => onSelect(option.value)}
      className="relative flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none aria-selected:bg-secondary aria-selected:text-secondary-foreground"
    >
      <Check className={cn("h-4 w-4 shrink-0", selected ? "opacity-100" : "opacity-0")} />
      <span className="truncate">{option.label}</span>
    </CommandPrimitive.Item>
  );
}

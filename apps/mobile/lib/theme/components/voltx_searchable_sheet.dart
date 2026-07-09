import 'package:flutter/material.dart';

import '../tokens/spacing.dart';
import '../voltx_theme.dart';
import 'voltx_text_field.dart';

const int _searchThreshold = 8;

/// Opens a searchable bottom sheet and returns the selected value(s) as a
/// set of `itemValue` strings, or null if the user dismissed it without
/// choosing. Inherits the app's global BottomSheetThemeData (surface
/// color, radius, drag handle) from app_theme.dart — no manual restyling.
Future<Set<String>?> showVoltxSearchableSheet<T>({
  required BuildContext context,
  required String title,
  required List<T> items,
  required String Function(T item) itemLabel,
  required String Function(T item) itemValue,
  String Function(T item)? itemGroup,
  Set<String> initialSelected = const {},
  bool multiSelect = false,
}) {
  return showModalBottomSheet<Set<String>>(
    context: context,
    isScrollControlled: true,
    builder: (context) => _SearchableSheetContent<T>(
      title: title,
      items: items,
      itemLabel: itemLabel,
      itemValue: itemValue,
      itemGroup: itemGroup,
      initialSelected: initialSelected,
      multiSelect: multiSelect,
    ),
  );
}

class _SearchableSheetContent<T> extends StatefulWidget {
  const _SearchableSheetContent({
    required this.title,
    required this.items,
    required this.itemLabel,
    required this.itemValue,
    required this.itemGroup,
    required this.initialSelected,
    required this.multiSelect,
  });

  final String title;
  final List<T> items;
  final String Function(T item) itemLabel;
  final String Function(T item) itemValue;
  final String Function(T item)? itemGroup;
  final Set<String> initialSelected;
  final bool multiSelect;

  @override
  State<_SearchableSheetContent<T>> createState() => _SearchableSheetContentState<T>();
}

class _SearchableSheetContentState<T> extends State<_SearchableSheetContent<T>> {
  late final TextEditingController _searchController;
  late Set<String> _selected;
  String _query = '';

  @override
  void initState() {
    super.initState();
    _searchController = TextEditingController();
    _selected = Set.of(widget.initialSelected);
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  List<T> get _filtered {
    if (_query.isEmpty) return widget.items;
    final lower = _query.toLowerCase();
    return widget.items.where((item) => widget.itemLabel(item).toLowerCase().contains(lower)).toList();
  }

  Map<String, List<T>>? get _grouped {
    final groupOf = widget.itemGroup;
    if (groupOf == null) return null;
    final map = <String, List<T>>{};
    for (final item in _filtered) {
      map.putIfAbsent(groupOf(item), () => []).add(item);
    }
    return map;
  }

  void _handleTap(T item) {
    final value = widget.itemValue(item);
    if (!widget.multiSelect) {
      Navigator.of(context).pop({value});
      return;
    }
    setState(() {
      if (_selected.contains(value)) {
        _selected.remove(value);
      } else {
        _selected.add(value);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.voltxColors;
    final showSearch = widget.items.length >= _searchThreshold;
    final grouped = _grouped;

    return DraggableScrollableSheet(
      initialChildSize: 0.7,
      minChildSize: 0.4,
      maxChildSize: 0.92,
      expand: false,
      builder: (context, scrollController) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                const SizedBox(height: AppSpacing.sm),
                Text(
                  widget.title,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: AppSpacing.sm),
                if (showSearch) ...[
                  VoltxTextField(
                    controller: _searchController,
                    hint: 'Search...',
                    prefixIcon: Icons.search_rounded,
                    autofocus: false,
                    onChanged: (value) => setState(() => _query = value),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                ],
                Expanded(
                  child: _filtered.isEmpty
                      ? Center(
                          child: Text(
                            'No results found.',
                            style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: colors.textTertiary),
                          ),
                        )
                      : ListView(
                          controller: scrollController,
                          children: grouped != null
                              ? _buildGrouped(context, grouped)
                              : _filtered.map((item) => _buildRow(context, item)).toList(),
                        ),
                ),
                if (widget.multiSelect) ...[
                  const SizedBox(height: AppSpacing.sm),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: () => Navigator.of(context).pop(_selected),
                      child: Text(
                        _selected.isEmpty ? 'Done' : 'Done (${_selected.length} selected)',
                      ),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                ],
              ],
            ),
          ),
        );
      },
    );
  }

  List<Widget> _buildGrouped(BuildContext context, Map<String, List<T>> grouped) {
    final colors = context.voltxColors;
    final widgets = <Widget>[];
    for (final entry in grouped.entries) {
      widgets.add(
        Padding(
          padding: const EdgeInsets.only(top: AppSpacing.sm, bottom: AppSpacing.xxs),
          child: Text(
            entry.key,
            style: Theme.of(context)
                .textTheme
                .labelSmall
                ?.copyWith(color: colors.textTertiary, fontWeight: FontWeight.w700),
          ),
        ),
      );
      widgets.addAll(entry.value.map((item) => _buildRow(context, item)));
    }
    return widgets;
  }

  Widget _buildRow(BuildContext context, T item) {
    final colors = context.voltxColors;
    final value = widget.itemValue(item);
    final selected = _selected.contains(value);

    return InkWell(
      onTap: () => _handleTap(item),
      borderRadius: context.voltxRadii.smBorder,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
        child: Row(
          children: [
            Icon(
              selected ? Icons.check_circle_rounded : Icons.circle_outlined,
              size: 20,
              color: selected ? Theme.of(context).colorScheme.primary : colors.borderSubtle,
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Text(
                widget.itemLabel(item),
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: colors.textPrimary),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

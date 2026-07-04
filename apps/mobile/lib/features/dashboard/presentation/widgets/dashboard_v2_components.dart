import 'package:flutter/material.dart';

import '../../../../theme/components/voltx_motion.dart';
import '../../../../theme/tokens/spacing.dart';
import 'dashboard_v2_tokens.dart';

class DashboardGlassCard extends StatelessWidget {
  const DashboardGlassCard({
    required this.child,
    this.padding,
    this.onTap,
    this.highlighted = false,
    super.key,
  });

  final Widget child;
  final EdgeInsetsGeometry? padding;
  final VoidCallback? onTap;
  final bool highlighted;

  @override
  Widget build(BuildContext context) {
    final t = DashboardV2Tokens.of(context);
    final card = Container(
      padding: padding ?? t.cardPadding,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(t.radiusXl),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            t.panel.withValues(alpha: highlighted ? 0.98 : 0.94),
            t.panelStrong.withValues(alpha: highlighted ? 0.95 : 0.9),
          ],
        ),
        border: Border.all(color: t.border.withValues(alpha: 0.9)),
        boxShadow: [
          ...t.cardShadow,
          BoxShadow(
            color: t.glow.withValues(alpha: highlighted ? 0.3 : 0.2),
            blurRadius: highlighted ? 34 : 26,
            spreadRadius: -14,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: child,
    );

    if (onTap == null) {
      return card;
    }

    return VoltxPressable(
      borderRadius: BorderRadius.circular(t.radiusXl),
      onTap: onTap,
      child: card,
    );
  }
}

class DashboardSectionHeader extends StatelessWidget {
  const DashboardSectionHeader({
    required this.title,
    this.subtitle,
    this.trailing,
    super.key,
  });

  final String title;
  final String? subtitle;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final t = DashboardV2Tokens.of(context);

    return LayoutBuilder(
      builder: (context, constraints) {
        final compact = constraints.maxWidth < 440;
        final content = Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: t.textPrimary,
                  ),
            ),
            if (subtitle != null) ...[
              const SizedBox(height: AppSpacing.xxs),
              Text(
                subtitle!,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: t.textSecondary,
                    ),
              ),
            ],
          ],
        );

        if (compact || trailing == null) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              content,
              if (trailing != null) ...[
                const SizedBox(height: AppSpacing.xs),
                trailing!,
              ],
            ],
          );
        }

        return Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(child: content),
            const SizedBox(width: AppSpacing.sm),
            trailing!,
          ],
        );
      },
    );
  }
}

class DashboardStatusBadge extends StatelessWidget {
  const DashboardStatusBadge({
    required this.label,
    required this.color,
    this.icon,
    super.key,
  });

  final String label;
  final Color color;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final t = DashboardV2Tokens.of(context);

    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.xxs,
      ),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(t.radiusPill),
        border: Border.all(color: color.withValues(alpha: 0.32)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 12, color: color),
            const SizedBox(width: AppSpacing.xxs),
          ],
          Text(
            label,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: color,
                  fontWeight: FontWeight.w700,
                ),
          ),
        ],
      ),
    );
  }
}

class DashboardLegendItem extends StatelessWidget {
  const DashboardLegendItem({
    required this.label,
    required this.color,
    this.value,
    super.key,
  });

  final String label;
  final Color color;
  final String? value;

  @override
  Widget build(BuildContext context) {
    final t = DashboardV2Tokens.of(context);

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 10,
          height: 10,
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(999),
          ),
        ),
        const SizedBox(width: AppSpacing.xxs),
        Text(
          label,
          style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: t.textSecondary,
                fontWeight: FontWeight.w600,
              ),
        ),
        if (value != null) ...[
          const SizedBox(width: AppSpacing.xxs),
          Text(
            value!,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: t.textPrimary,
                  fontWeight: FontWeight.w700,
                ),
          ),
        ],
      ],
    );
  }
}

class DashboardOwnerAvatar extends StatelessWidget {
  const DashboardOwnerAvatar({
    required this.name,
    this.size = 28,
    super.key,
  });

  final String name;
  final double size;

  String _initials(String fullName) {
    final parts = fullName.trim().split(RegExp(r'\s+'));
    if (parts.isEmpty) {
      return 'U';
    }
    if (parts.length == 1) {
      return parts.first.substring(0, 1).toUpperCase();
    }
    return '${parts.first.substring(0, 1)}${parts.last.substring(0, 1)}'
        .toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    final t = DashboardV2Tokens.of(context);
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            t.primary.withValues(alpha: 0.88),
            t.primary.withValues(alpha: 0.54),
          ],
        ),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: t.borderStrong.withValues(alpha: 0.6)),
      ),
      alignment: Alignment.center,
      child: Text(
        _initials(name),
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: Colors.white,
              fontWeight: FontWeight.w800,
            ),
      ),
    );
  }
}

class DashboardAvatarGroup extends StatelessWidget {
  const DashboardAvatarGroup({
    required this.names,
    this.size = 28,
    this.max = 3,
    super.key,
  });

  final List<String> names;
  final double size;
  final int max;

  @override
  Widget build(BuildContext context) {
    final t = DashboardV2Tokens.of(context);
    final visible = names.take(max).toList();
    final hidden = names.length - visible.length;
    final overlap = size * 0.65;

    return SizedBox(
      width: (size * visible.length) - ((visible.length - 1) * (size * 0.35)) +
          (hidden > 0 ? size * 0.82 : 0),
      height: size,
      child: Stack(
        children: [
          for (var i = 0; i < visible.length; i++)
            Positioned(
              left: i * overlap,
              child: DashboardOwnerAvatar(name: visible[i], size: size),
            ),
          if (hidden > 0)
            Positioned(
              left: visible.length * overlap,
              child: Container(
                width: size,
                height: size,
                decoration: BoxDecoration(
                  color: t.panelStrong,
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(color: t.border),
                ),
                alignment: Alignment.center,
                child: Text(
                  '+$hidden',
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: t.textPrimary,
                        fontWeight: FontWeight.w700,
                      ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class DashboardTimelineDot extends StatelessWidget {
  const DashboardTimelineDot({
    required this.color,
    this.showConnector = true,
    super.key,
  });

  final Color color;
  final bool showConnector;

  @override
  Widget build(BuildContext context) {
    final t = DashboardV2Tokens.of(context);

    return Column(
      children: [
        Container(
          width: 12,
          height: 12,
          decoration: BoxDecoration(
            color: color,
            shape: BoxShape.circle,
            border: Border.all(color: color.withValues(alpha: 0.35), width: 3),
          ),
        ),
        if (showConnector)
          Container(
            width: 2,
            height: 58,
            margin: const EdgeInsets.only(top: AppSpacing.xxs),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(999),
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  t.borderStrong.withValues(alpha: 0.85),
                  t.border.withValues(alpha: 0.22),
                ],
              ),
            ),
          ),
      ],
    );
  }
}

class DashboardSparkline extends StatelessWidget {
  const DashboardSparkline({
    required this.values,
    required this.color,
    super.key,
  });

  final List<double> values;
  final Color color;

  @override
  Widget build(BuildContext context) {
    if (values.isEmpty) {
      return const SizedBox(height: 40);
    }

    return SizedBox(
      height: 40,
      width: double.infinity,
      child: CustomPaint(
        painter: _SparklinePainter(
          values: values,
          color: color,
        ),
      ),
    );
  }
}

class _SparklinePainter extends CustomPainter {
  _SparklinePainter({required this.values, required this.color});

  final List<double> values;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    if (values.length < 2) {
      return;
    }

    final points = <Offset>[];
    for (var i = 0; i < values.length; i++) {
      final x = (i / (values.length - 1)) * size.width;
      final y = size.height - ((values[i].clamp(0, 1)) * (size.height - 4)) - 2;
      points.add(Offset(x, y));
    }

    final areaPath = Path()..moveTo(points.first.dx, size.height);
    for (final point in points) {
      areaPath.lineTo(point.dx, point.dy);
    }
    areaPath.lineTo(points.last.dx, size.height);
    areaPath.close();

    final areaPaint = Paint()
      ..shader = LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [
          color.withValues(alpha: 0.24),
          color.withValues(alpha: 0.03),
        ],
      ).createShader(Rect.fromLTWH(0, 0, size.width, size.height));

    canvas.drawPath(areaPath, areaPaint);

    final linePath = Path()..moveTo(points.first.dx, points.first.dy);
    for (var i = 1; i < points.length; i++) {
      final prev = points[i - 1];
      final curr = points[i];
      final controlX = (prev.dx + curr.dx) / 2;
      linePath.cubicTo(controlX, prev.dy, controlX, curr.dy, curr.dx, curr.dy);
    }

    final linePaint = Paint()
      ..color = color
      ..strokeWidth = 2.1
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    canvas.drawPath(linePath, linePaint);

    final dotPaint = Paint()..color = color;
    canvas.drawCircle(points.last, 2.6, dotPaint);
  }

  @override
  bool shouldRepaint(covariant _SparklinePainter oldDelegate) {
    return oldDelegate.values != values || oldDelegate.color != color;
  }
}

class DashboardSkeletonLine extends StatelessWidget {
  const DashboardSkeletonLine({
    this.width,
    this.height = 12,
    super.key,
  });

  final double? width;
  final double height;

  @override
  Widget build(BuildContext context) {
    return VoltxLoadingSkeleton(
      width: width,
      height: height,
    );
  }
}

class DashboardEmptyState extends StatelessWidget {
  const DashboardEmptyState({
    required this.title,
    required this.subtitle,
    this.icon = Icons.inbox_outlined,
    this.suggestion,
    this.actionLabel,
    this.onAction,
    super.key,
  });

  final String title;
  final String subtitle;
  final IconData icon;
  final String? suggestion;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    final t = DashboardV2Tokens.of(context);

    return Center(
      child: VoltxScaleIn(
        begin: 0.96,
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.md),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Icon(icon, size: 24, color: t.textTertiary),
              const SizedBox(height: AppSpacing.xs),
              Text(
                title,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: t.textPrimary,
                      fontWeight: FontWeight.w700,
                    ),
              ),
              const SizedBox(height: AppSpacing.xxs),
              Text(
                subtitle,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: t.textSecondary,
                    ),
              ),
              if (suggestion != null) ...[
                const SizedBox(height: AppSpacing.sm),
                DashboardStatusBadge(
                  label: suggestion!,
                  color: t.primary,
                  icon: Icons.auto_awesome_rounded,
                ),
              ],
              if (actionLabel != null && onAction != null) ...[
                const SizedBox(height: AppSpacing.sm),
                FilledButton.tonalIcon(
                  onPressed: onAction,
                  icon: const Icon(Icons.play_arrow_rounded, size: 16),
                  label: Text(actionLabel!),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

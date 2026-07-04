import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../tokens/motion_tokens.dart';
import '../voltx_theme.dart';

class VoltxPageTransitionsBuilder extends PageTransitionsBuilder {
  const VoltxPageTransitionsBuilder();

  @override
  Widget buildTransitions<T>(
    PageRoute<T> route,
    BuildContext context,
    Animation<double> animation,
    Animation<double> secondaryAnimation,
    Widget child,
  ) {
    return VoltxPageTransition.fadeSlide(
      context,
      animation,
      secondaryAnimation,
      child,
    );
  }
}

class VoltxFadeIn extends StatefulWidget {
  const VoltxFadeIn({
    required this.child,
    this.delay = Duration.zero,
    this.duration,
    this.curve,
    this.from = 0,
    super.key,
  });

  final Widget child;
  final Duration delay;
  final Duration? duration;
  final Curve? curve;
  final double from;

  @override
  State<VoltxFadeIn> createState() => _VoltxFadeInState();
}

class _VoltxFadeInState extends State<VoltxFadeIn>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _opacity;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: widget.duration ?? MotionTokens.normal,
    );
    _opacity = Tween<double>(begin: widget.from, end: 1).animate(
      CurvedAnimation(
        parent: _controller,
        curve: widget.curve ?? MotionTokens.standard,
      ),
    );

    if (widget.delay == Duration.zero) {
      _controller.forward();
    } else {
      Future<void>.delayed(widget.delay, () {
        if (mounted) {
          _controller.forward();
        }
      });
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(opacity: _opacity, child: widget.child);
  }
}

class VoltxSlideIn extends StatefulWidget {
  const VoltxSlideIn({
    required this.child,
    this.begin = const Offset(0, 0.03),
    this.delay = Duration.zero,
    this.duration,
    this.curve,
    super.key,
  });

  final Widget child;
  final Offset begin;
  final Duration delay;
  final Duration? duration;
  final Curve? curve;

  @override
  State<VoltxSlideIn> createState() => _VoltxSlideInState();
}

class _VoltxSlideInState extends State<VoltxSlideIn>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<Offset> _offset;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: widget.duration ?? MotionTokens.normal,
    );
    _offset = Tween<Offset>(begin: widget.begin, end: Offset.zero).animate(
      CurvedAnimation(
        parent: _controller,
        curve: widget.curve ?? MotionTokens.standard,
      ),
    );

    if (widget.delay == Duration.zero) {
      _controller.forward();
    } else {
      Future<void>.delayed(widget.delay, () {
        if (mounted) {
          _controller.forward();
        }
      });
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SlideTransition(position: _offset, child: widget.child);
  }
}

class VoltxScaleIn extends StatefulWidget {
  const VoltxScaleIn({
    required this.child,
    this.begin = 0.96,
    this.delay = Duration.zero,
    this.duration,
    this.curve,
    super.key,
  });

  final Widget child;
  final double begin;
  final Duration delay;
  final Duration? duration;
  final Curve? curve;

  @override
  State<VoltxScaleIn> createState() => _VoltxScaleInState();
}

class _VoltxScaleInState extends State<VoltxScaleIn>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _scale;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: widget.duration ?? MotionTokens.normal,
    );
    _scale = Tween<double>(begin: widget.begin, end: 1).animate(
      CurvedAnimation(
        parent: _controller,
        curve: widget.curve ?? MotionTokens.spring,
      ),
    );

    if (widget.delay == Duration.zero) {
      _controller.forward();
    } else {
      Future<void>.delayed(widget.delay, () {
        if (mounted) {
          _controller.forward();
        }
      });
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ScaleTransition(scale: _scale, child: widget.child);
  }
}

class VoltxPressable extends StatefulWidget {
  const VoltxPressable({
    required this.child,
    this.onTap,
    this.onLongPress,
    this.scaleDown = 0.98,
    this.borderRadius,
    this.enableHover = true,
    this.cursor,
    super.key,
  });

  final Widget child;
  final VoidCallback? onTap;
  final VoidCallback? onLongPress;
  final double scaleDown;
  final BorderRadius? borderRadius;
  final bool enableHover;
  final MouseCursor? cursor;

  @override
  State<VoltxPressable> createState() => _VoltxPressableState();
}

class _VoltxPressableState extends State<VoltxPressable> {
  bool _pressed = false;
  bool _hovered = false;

  @override
  Widget build(BuildContext context) {
    final motion = context.voltxMotion;

    final scale = _pressed
        ? widget.scaleDown
        : _hovered && widget.enableHover
            ? 1.01
        : 1.0;

    return MouseRegion(
      cursor: widget.cursor ??
          (widget.onTap != null
              ? SystemMouseCursors.click
              : MouseCursor.defer),
      onEnter: (_) => setState(() => _hovered = true),
      onExit: (_) => setState(() {
        _hovered = false;
        _pressed = false;
      }),
      child: GestureDetector(
        onTap: widget.onTap,
        onLongPress: widget.onLongPress,
        onTapDown: (_) => setState(() => _pressed = true),
        onTapCancel: () => setState(() => _pressed = false),
        onTapUp: (_) => setState(() => _pressed = false),
        child: AnimatedScale(
          duration: motion.fast,
          curve: motion.standardCurve,
          scale: scale,
          child: ClipRRect(
            borderRadius: widget.borderRadius ?? BorderRadius.circular(12),
            child: widget.child,
          ),
        ),
      ),
    );
  }
}

class VoltxHoverCard extends StatefulWidget {
  const VoltxHoverCard({
    required this.child,
    this.onTap,
    this.borderRadius,
    this.lift = 5,
    super.key,
  });

  final Widget child;
  final VoidCallback? onTap;
  final BorderRadius? borderRadius;
  final double lift;

  @override
  State<VoltxHoverCard> createState() => _VoltxHoverCardState();
}

class _VoltxHoverCardState extends State<VoltxHoverCard> {
  bool _hovered = false;
  bool _focused = false;

  @override
  Widget build(BuildContext context) {
    final motion = context.voltxMotion;
    final colors = context.voltxColors;

    final dy = _hovered ? -widget.lift : 0.0;

    return FocusableActionDetector(
      onShowFocusHighlight: (v) => setState(() => _focused = v),
      child: MouseRegion(
        cursor: widget.onTap != null
            ? SystemMouseCursors.click
            : MouseCursor.defer,
        onEnter: (_) => setState(() => _hovered = true),
        onExit: (_) => setState(() => _hovered = false),
        child: AnimatedContainer(
          duration: motion.normal,
          curve: motion.emphasizedCurve,
          transform: Matrix4.translationValues(0, dy, 0),
          decoration: BoxDecoration(
            borderRadius: widget.borderRadius ?? BorderRadius.circular(16),
            border: _focused
                ? Border.all(color: Theme.of(context).colorScheme.primary, width: 1.2)
                : null,
            boxShadow: _hovered
                ? [
                    ...context.voltxShadows.card,
                    BoxShadow(
                      color: colors.borderStrong.withValues(alpha: 0.16),
                      blurRadius: 14,
                      offset: const Offset(0, 8),
                    ),
                  ]
                : null,
          ),
          child: Material(
            color: Colors.transparent,
            child: InkWell(
              borderRadius: widget.borderRadius ?? BorderRadius.circular(16),
              onTap: widget.onTap,
              child: widget.child,
            ),
          ),
        ),
      ),
    );
  }
}

class VoltxAnimatedContainer extends StatelessWidget {
  const VoltxAnimatedContainer({
    required this.child,
    this.padding,
    this.margin,
    this.decoration,
    this.duration,
    this.curve,
    super.key,
  });

  final Widget child;
  final EdgeInsetsGeometry? padding;
  final EdgeInsetsGeometry? margin;
  final Decoration? decoration;
  final Duration? duration;
  final Curve? curve;

  @override
  Widget build(BuildContext context) {
    final motion = context.voltxMotion;
    return AnimatedContainer(
      duration: duration ?? motion.normal,
      curve: curve ?? motion.standardCurve,
      padding: padding,
      margin: margin,
      decoration: decoration,
      child: child,
    );
  }
}

class VoltxAnimatedGradient extends StatefulWidget {
  const VoltxAnimatedGradient({
    required this.child,
    required this.colors,
    this.duration,
    this.curve,
    this.begin = Alignment.topLeft,
    this.end = Alignment.bottomRight,
    super.key,
  });

  final Widget child;
  final List<Color> colors;
  final Duration? duration;
  final Curve? curve;
  final AlignmentGeometry begin;
  final AlignmentGeometry end;

  @override
  State<VoltxAnimatedGradient> createState() => _VoltxAnimatedGradientState();
}

class _VoltxAnimatedGradientState extends State<VoltxAnimatedGradient> {
  bool _flip = false;

  @override
  void initState() {
    super.initState();
    Future<void>.delayed(const Duration(milliseconds: 16), () {
      if (mounted) {
        setState(() => _flip = true);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final motion = context.voltxMotion;
    return AnimatedContainer(
      duration: widget.duration ?? motion.emphasis,
      curve: widget.curve ?? motion.emphasizedCurve,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: _flip ? widget.end : widget.begin,
          end: _flip ? widget.begin : widget.end,
          colors: widget.colors,
        ),
      ),
      child: widget.child,
    );
  }
}

class VoltxShimmer extends StatefulWidget {
  const VoltxShimmer({
    required this.child,
    this.baseColor,
    this.highlightColor,
    this.duration,
    super.key,
  });

  final Widget child;
  final Color? baseColor;
  final Color? highlightColor;
  final Duration? duration;

  @override
  State<VoltxShimmer> createState() => _VoltxShimmerState();
}

class _VoltxShimmerState extends State<VoltxShimmer>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: widget.duration ?? MotionTokens.shimmerCycle,
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.voltxColors;
    final base = widget.baseColor ?? colors.surfaceMuted;
    final highlight = widget.highlightColor ?? colors.surfaceElevated;

    return AnimatedBuilder(
      animation: _controller,
      child: widget.child,
      builder: (context, child) {
        final x = (_controller.value * 2) - 1;
        return ShaderMask(
          shaderCallback: (rect) {
            return LinearGradient(
              begin: Alignment(-1 + x, -0.3),
              end: Alignment(1 + x, 0.3),
              colors: [
                base,
                highlight.withValues(alpha: 0.95),
                base,
              ],
              stops: const [0.2, 0.5, 0.8],
            ).createShader(rect);
          },
          blendMode: BlendMode.srcATop,
          child: child,
        );
      },
    );
  }
}

class VoltxLoadingSkeleton extends StatelessWidget {
  const VoltxLoadingSkeleton({
    this.width,
    this.height = 14,
    this.borderRadius,
    super.key,
  });

  final double? width;
  final double height;
  final BorderRadius? borderRadius;

  @override
  Widget build(BuildContext context) {
    final colors = context.voltxColors;
    return VoltxShimmer(
      child: Container(
        width: width,
        height: height,
        decoration: BoxDecoration(
          color: colors.surfaceMuted,
          borderRadius: borderRadius ?? BorderRadius.circular(999),
        ),
      ),
    );
  }
}

class VoltxPageTransition {
  const VoltxPageTransition._();

  static Widget fadeSlide(
    BuildContext context,
    Animation<double> animation,
    Animation<double> secondaryAnimation,
    Widget child,
  ) {
    final motion = context.voltxMotion;
    final curved = CurvedAnimation(
      parent: animation,
      curve: motion.standardCurve,
      reverseCurve: motion.decelerateCurve,
    );
    return FadeTransition(
      opacity: curved,
      child: SlideTransition(
        position: Tween<Offset>(
          begin: const Offset(0, 0.02),
          end: Offset.zero,
        ).animate(curved),
        child: child,
      ),
    );
  }

  static PageRouteBuilder<T> route<T>({required Widget page}) {
    return PageRouteBuilder<T>(
      transitionDuration: MotionTokens.pageTransition,
      reverseTransitionDuration: MotionTokens.fast,
      pageBuilder: (_, _, _) => page,
      transitionsBuilder: (context, animation, secondaryAnimation, child) {
        return fadeSlide(context, animation, secondaryAnimation, child);
      },
    );
  }
}

class VoltxNavigationTransition extends StatelessWidget {
  const VoltxNavigationTransition({
    required this.child,
    required this.transitionKey,
    super.key,
  });

  final Widget child;
  final Object transitionKey;

  @override
  Widget build(BuildContext context) {
    final motion = context.voltxMotion;
    return AnimatedSwitcher(
      duration: motion.navigation,
      reverseDuration: motion.fast,
      switchInCurve: motion.emphasizedCurve,
      switchOutCurve: motion.standardCurve,
      transitionBuilder: (child, animation) {
        return FadeTransition(
          opacity: animation,
          child: SlideTransition(
            position: Tween<Offset>(
              begin: const Offset(0.012, 0),
              end: Offset.zero,
            ).animate(animation),
            child: child,
          ),
        );
      },
      child: KeyedSubtree(key: ValueKey<Object>(transitionKey), child: child),
    );
  }
}

class VoltxAnimatedIcon extends StatelessWidget {
  const VoltxAnimatedIcon({
    required this.icon,
    this.duration,
    this.color,
    this.size = 20,
    super.key,
  });

  final IconData icon;
  final Duration? duration;
  final Color? color;
  final double size;

  @override
  Widget build(BuildContext context) {
    final motion = context.voltxMotion;
    return AnimatedSwitcher(
      duration: duration ?? motion.fast,
      transitionBuilder: (child, animation) => ScaleTransition(
        scale: animation,
        child: FadeTransition(opacity: animation, child: child),
      ),
      child: Icon(
        key: ValueKey<IconData>(icon),
        icon,
        color: color,
        size: size,
      ),
    );
  }
}

class VoltxAnimatedButton extends StatelessWidget {
  const VoltxAnimatedButton({
    required this.child,
    this.onTap,
    this.borderRadius,
    super.key,
  });

  final Widget child;
  final VoidCallback? onTap;
  final BorderRadius? borderRadius;

  @override
  Widget build(BuildContext context) {
    return VoltxPressable(
      onTap: onTap,
      borderRadius: borderRadius,
      child: child,
    );
  }
}

class VoltxDrawerTransition extends StatelessWidget {
  const VoltxDrawerTransition({
    required this.open,
    required this.child,
    this.duration,
    this.widthFactor = 1,
    super.key,
  });

  final bool open;
  final Widget child;
  final Duration? duration;
  final double widthFactor;

  @override
  Widget build(BuildContext context) {
    final motion = context.voltxMotion;
    return AnimatedSlide(
      duration: duration ?? motion.drawer,
      curve: motion.emphasizedCurve,
      offset: open ? Offset.zero : const Offset(-1, 0),
      child: AnimatedOpacity(
        duration: duration ?? motion.drawer,
        opacity: open ? 1 : 0,
        child: Align(
          alignment: Alignment.centerLeft,
          widthFactor: widthFactor,
          child: child,
        ),
      ),
    );
  }
}

class VoltxSidebarCollapse extends StatelessWidget {
  const VoltxSidebarCollapse({
    required this.collapsed,
    required this.child,
    this.expandedWidth = 300,
    this.collapsedWidth = 80,
    this.duration,
    super.key,
  });

  final bool collapsed;
  final Widget child;
  final double expandedWidth;
  final double collapsedWidth;
  final Duration? duration;

  @override
  Widget build(BuildContext context) {
    final motion = context.voltxMotion;
    return AnimatedContainer(
      duration: duration ?? motion.sidebar,
      curve: motion.emphasizedCurve,
      width: collapsed ? collapsedWidth : expandedWidth,
      child: child,
    );
  }
}

class VoltxFloatingActionMotion extends StatefulWidget {
  const VoltxFloatingActionMotion({
    required this.child,
    this.visible = true,
    super.key,
  });

  final Widget child;
  final bool visible;

  @override
  State<VoltxFloatingActionMotion> createState() => _VoltxFloatingActionMotionState();
}

class _VoltxFloatingActionMotionState extends State<VoltxFloatingActionMotion> {
  @override
  Widget build(BuildContext context) {
    final motion = context.voltxMotion;
    return AnimatedSlide(
      duration: motion.normal,
      curve: motion.emphasizedCurve,
      offset: widget.visible ? Offset.zero : const Offset(0, 0.35),
      child: AnimatedScale(
        duration: motion.fast,
        scale: widget.visible ? 1 : 0.92,
        child: AnimatedOpacity(
          duration: motion.fast,
          opacity: widget.visible ? 1 : 0,
          child: widget.child,
        ),
      ),
    );
  }
}

class VoltxTypingDots extends StatefulWidget {
  const VoltxTypingDots({
    this.dotCount = 3,
    this.dotSize = 7,
    this.spacing = 5,
    this.color,
    super.key,
  });

  final int dotCount;
  final double dotSize;
  final double spacing;
  final Color? color;

  @override
  State<VoltxTypingDots> createState() => _VoltxTypingDotsState();
}

class _VoltxTypingDotsState extends State<VoltxTypingDots>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: MotionTokens.shimmerCycle,
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final dotColor = widget.color ?? context.voltxColors.textSecondary;

    return AnimatedBuilder(
      animation: _controller,
      builder: (context, _) {
        final progress = _controller.value;
        return Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            for (var i = 0; i < widget.dotCount; i++) ...[
              if (i > 0) SizedBox(width: widget.spacing),
              _TypingDot(
                size: widget.dotSize,
                color: dotColor,
                progress: progress,
                phase: i / widget.dotCount,
              ),
            ],
          ],
        );
      },
    );
  }
}

class _TypingDot extends StatelessWidget {
  const _TypingDot({
    required this.size,
    required this.color,
    required this.progress,
    required this.phase,
  });

  final double size;
  final Color color;
  final double progress;
  final double phase;

  @override
  Widget build(BuildContext context) {
    var t = (progress - phase) % 1;
    if (t < 0) {
      t += 1;
    }
    final wave = math.sin(t * math.pi * 2);
    final scale = 0.7 + ((wave + 1) * 0.2);
    final opacity = 0.38 + ((wave + 1) * 0.24);

    return Opacity(
      opacity: opacity,
      child: Transform.scale(
        scale: scale,
        child: Container(
          width: size,
          height: size,
          decoration: BoxDecoration(
            color: color,
            shape: BoxShape.circle,
          ),
        ),
      ),
    );
  }
}

import { Button, HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  background,
  buttonStyle,
  containerBackground,
  controlSize,
  font,
  foregroundStyle,
  frame,
  monospacedDigit,
  padding,
  shapes,
  tint,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

import type { SleepHomeWidgetProps } from '@/lib/sleepHomeWidget';
import { optimisticSleepHomeWidgetProps } from '@/lib/sleepWidgetOptimistic';

const SleepHomeWidgetLayout = (
  props: SleepHomeWidgetProps,
  environment: WidgetEnvironment
) => {
  'widget';

  const navy = '#0A122E';
  const card = '#162240';
  const muted = '#8B90B8';
  const danger = '#D4847C';
  const accent =
    props.statusTone === 'awake'
      ? '#DBB6AF'
      : props.statusTone === 'paused'
        ? '#7CA8D8'
        : '#A3A5CE';
  const readinessColor =
    props.readinessTone === 'ready'
      ? '#D4847C'
      : props.readinessTone === 'prepare'
        ? '#DBB6AF'
        : '#6B7FBF';

  const family = environment.widgetFamily;
  const isSmall = family === 'systemSmall';
  const isCircular = family === 'accessoryCircular';
  const isRectangular = family === 'accessoryRectangular';
  const isInline = family === 'accessoryInline';
  const iconName = props.paused
    ? 'moon.zzz.fill'
    : props.asleep
      ? 'moon.fill'
      : 'sun.max.fill';
  const timerLower = new Date(props.timerLowerMs);
  const timerUpper = new Date(props.timerUpperMs);
  const primaryIsEnd = props.asleep;

  // Lock Screen / StandBy — compact, no action chrome (tap opens app).
  if (isCircular) {
    return (
      <VStack
        spacing={2}
        modifiers={[frame({ maxWidth: 999 }), widgetURL('relaxo:///')]}
      >
        <Image systemName={iconName} color={accent} size={16} />
        {props.showTimer ? (
          <Text
            timerInterval={{ lower: timerLower, upper: timerUpper }}
            countsDown={false}
            modifiers={[
              font({ weight: 'bold', size: 12, design: 'rounded' }),
              foregroundStyle(accent),
              monospacedDigit(),
            ]}
          />
        ) : (
          <Text modifiers={[font({ size: 11, weight: 'semibold' }), foregroundStyle(accent)]}>
            {props.asleep ? props.labelNap : '—'}
          </Text>
        )}
      </VStack>
    );
  }

  if (isInline) {
    const inlineLabel = props.asleep
      ? props.paused
        ? props.labelBabyAwake
        : props.title
      : props.showPrediction && props.predictionTime
        ? `${props.predictionTime}`
        : props.subtitle;
    return (
      <Text modifiers={[widgetURL('relaxo:///'), font({ size: 14, weight: 'semibold' })]}>
        {`Relaxo · ${inlineLabel}`}
      </Text>
    );
  }

  if (isRectangular) {
    return (
      <HStack
        spacing={8}
        modifiers={[frame({ maxWidth: 999 }), widgetURL('relaxo:///'), padding({ all: 4 })]}
      >
        <Image systemName={iconName} color={accent} size={18} />
        <VStack spacing={2} modifiers={[frame({ maxWidth: 999, alignment: 'leading' })]}>
          <Text modifiers={[font({ weight: 'bold', size: 13 }), foregroundStyle(accent)]}>
            {props.title}
          </Text>
          {props.showTimer ? (
            <Text
              timerInterval={{ lower: timerLower, upper: timerUpper }}
              countsDown={false}
              modifiers={[
                font({ weight: 'bold', size: 20, design: 'rounded' }),
                foregroundStyle(accent),
                monospacedDigit(),
              ]}
            />
          ) : null}
          <Text modifiers={[font({ size: 11 }), foregroundStyle(muted)]}>
            {props.showPrediction && props.predictionTime
              ? `${props.predictionLabel} ${props.predictionTime}`
              : props.subtitle}
          </Text>
        </VStack>
      </HStack>
    );
  }

  const primaryButton = (
    <Button
      label={props.primaryLabel}
      target={props.primaryTarget}
      onPress={() => optimisticSleepHomeWidgetProps(props, props.primaryTarget) as never}
      modifiers={[
        buttonStyle(primaryIsEnd ? 'bordered' : 'borderedProminent'),
        controlSize('small'),
        tint(primaryIsEnd ? danger : accent),
      ]}
    />
  );

  const secondaryButton = (
    <Button
      label={props.secondaryLabel}
      target={props.secondaryTarget}
      onPress={() => optimisticSleepHomeWidgetProps(props, props.secondaryTarget) as never}
      modifiers={[
        buttonStyle(props.asleep ? 'borderedProminent' : 'bordered'),
        controlSize('small'),
        tint(props.asleep ? accent : muted),
      ]}
    />
  );

  // Icon-only sync on small; keep compact on medium so bottom inset stays clear.
  const syncButton = (
    <Button
      label={isSmall ? ' ' : props.labelSync}
      systemImage="arrow.triangle.2.circlepath"
      target="sync"
      onPress={() => optimisticSleepHomeWidgetProps(props, 'sync') as never}
      modifiers={[
        buttonStyle('bordered'),
        controlSize('small'),
        tint(muted),
        frame({ minWidth: 36 }),
      ]}
    />
  );

  const iconBadge = (
    <Image
      systemName={iconName}
      color={accent}
      size={isSmall ? 18 : 22}
      modifiers={[
        padding({ all: isSmall ? 6 : 8 }),
        background(card, shapes.roundedRectangle({ cornerRadius: 12 })),
      ]}
    />
  );

  const header = (
    <HStack spacing={10}>
      {iconBadge}
      <VStack spacing={2} modifiers={[frame({ maxWidth: 999, alignment: 'leading' })]}>
        <Text
          modifiers={[
            font({ weight: 'bold', size: isSmall ? 15 : 17 }),
            foregroundStyle('#EDEAF5'),
          ]}
        >
          {props.title}
        </Text>
        <Text modifiers={[font({ size: isSmall ? 11 : 12 }), foregroundStyle(muted)]}>
          {props.subtitle}
        </Text>
      </VStack>
      <Spacer />
      {isSmall ? syncButton : null}
    </HStack>
  );

  const timer = props.showTimer ? (
    <Text
      timerInterval={{ lower: timerLower, upper: timerUpper }}
      countsDown={false}
      modifiers={[
        font({ weight: 'bold', size: isSmall ? 28 : 36, design: 'rounded' }),
        foregroundStyle(accent),
        monospacedDigit(),
      ]}
    />
  ) : null;

  const readinessChip = props.showReadiness ? (
    <Text
      modifiers={[
        font({ weight: 'semibold', size: 11 }),
        foregroundStyle(readinessColor),
        padding({ horizontal: 8, vertical: 4 }),
        background(card, shapes.roundedRectangle({ cornerRadius: 8 })),
      ]}
    >
      {props.readinessLabel}
    </Text>
  ) : null;

  const predictionCard = props.showPrediction ? (
    <VStack
      spacing={4}
      modifiers={[
        padding({ all: isSmall ? 8 : 12 }),
        background(card, shapes.roundedRectangle({ cornerRadius: 14 })),
        frame({ maxWidth: 999, alignment: 'leading' }),
      ]}
    >
      <Text modifiers={[font({ size: 11 }), foregroundStyle(muted)]}>
        {props.predictionLabel}
      </Text>
      <Text
        modifiers={[
          font({ weight: 'bold', size: isSmall ? 18 : 26, design: 'rounded' }),
          foregroundStyle('#EDEAF5'),
        ]}
      >
        {props.predictionTime}
      </Text>
      {readinessChip}
    </VStack>
  ) : null;

  // Extra bottom padding on the action row itself — container padding alone is
  // easy to lose against the widget chrome / rounded clip.
  const actions = isSmall ? (
    <VStack
      spacing={6}
      modifiers={[frame({ maxWidth: 999 }), padding({ bottom: 10 })]}
    >
      {primaryButton}
      {secondaryButton}
    </VStack>
  ) : (
    <HStack
      spacing={8}
      modifiers={[frame({ maxWidth: 999 }), padding({ bottom: 12 })]}
    >
      {secondaryButton}
      {primaryButton}
      <Spacer />
      {syncButton}
    </HStack>
  );

  // Home Screen interactive widgets: do NOT put widgetURL on the root.
  // A root widgetURL steals taps from Button AppIntents, so Start/End appear
  // to do nothing until the app is opened manually.
  if (isSmall) {
    return (
      <VStack
        spacing={8}
        modifiers={[
          padding({ top: 12, leading: 12, trailing: 12, bottom: 14 }),
          containerBackground(navy, 'widget'),
        ]}
      >
        {header}
        {timer}
        {readinessChip}
        <Spacer />
        {actions}
      </VStack>
    );
  }

  return (
    <VStack
      spacing={10}
      modifiers={[
        padding({ top: 14, leading: 14, trailing: 14, bottom: 14 }),
        containerBackground(navy, 'widget'),
      ]}
    >
      <HStack spacing={14} modifiers={[frame({ maxWidth: 999, alignment: 'top' })]}>
        <VStack spacing={6} modifiers={[frame({ maxWidth: 999, alignment: 'leading' })]}>
          {header}
          {timer}
          {!props.showPrediction ? readinessChip : null}
        </VStack>
        {predictionCard}
      </HStack>
      <Spacer />
      {actions}
    </VStack>
  );
};

export default createWidget('SleepHomeWidget', SleepHomeWidgetLayout);

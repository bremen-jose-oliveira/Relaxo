import { Button, HStack, Image, Text, VStack } from '@expo/ui/swift-ui';
import {
  buttonStyle,
  controlSize,
  font,
  foregroundStyle,
  frame,
  monospacedDigit,
  padding,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity, type LiveActivityEnvironment } from 'expo-widgets';

type SleepLiveActivityProps = {
  title: string;
  subtitle: string;
  paused: boolean;
  timerLowerMs: number;
  timerUpperMs: number;
  endLabel: string;
  secondaryLabel: string;
  secondaryTarget: 'pause' | 'resume';
  endTarget: 'end';
};

const SleepLiveActivityLayout = (
  props: SleepLiveActivityProps,
  environment: LiveActivityEnvironment
) => {
  'widget';

  const accent = environment.isLuminanceReduced ? '#FFFFFF' : '#A3A5CE';
  const secondary = environment.isLuminanceReduced ? '#DDDDDD' : '#C5C8E0';
  const danger = environment.isLuminanceReduced ? '#FFCCCC' : '#D4847C';
  const iconName = props.paused ? 'moon.zzz' : 'moon.fill';
  const timerLower = new Date(props.timerLowerMs);
  const timerUpper = new Date(props.timerUpperMs);

  // Lock Screen / expanded — room for a larger timer.
  const timer = (
    <Text
      timerInterval={{ lower: timerLower, upper: timerUpper }}
      countsDown={false}
      modifiers={[
        font({ weight: 'semibold', size: 28, design: 'rounded' }),
        foregroundStyle(accent),
        monospacedDigit(),
      ]}
    />
  );

  // Dynamic Island compactTrailing is ~52–62pt wide. Unconstrained
  // Text(timerInterval:) stretches the island over the status bar.
  const compactTimer = (
    <Text
      timerInterval={{ lower: timerLower, upper: timerUpper }}
      countsDown={false}
      modifiers={[
        font({ weight: 'semibold', size: 13, design: 'rounded' }),
        foregroundStyle(accent),
        monospacedDigit(),
        frame({ maxWidth: 52, alignment: 'trailing' }),
      ]}
    />
  );

  const actions = (
    <HStack spacing={8}>
      <Button
        label={props.secondaryLabel}
        target={props.secondaryTarget}
        modifiers={[buttonStyle('borderedProminent'), controlSize('small'), tint(accent)]}
      />
      <Button
        label={props.endLabel}
        target={props.endTarget}
        modifiers={[buttonStyle('bordered'), controlSize('small'), tint(danger)]}
      />
    </HStack>
  );

  return {
    banner: (
      <VStack spacing={10} modifiers={[padding({ all: 14 })]}>
        <HStack spacing={10}>
          <Image systemName={iconName} color={accent} size={18} />
          <VStack spacing={2}>
            <Text modifiers={[font({ weight: 'bold', size: 16 }), foregroundStyle(accent)]}>
              {props.title}
            </Text>
            <Text modifiers={[font({ size: 12 }), foregroundStyle(secondary)]}>
              {props.subtitle}
            </Text>
          </VStack>
          {timer}
        </HStack>
        {actions}
      </VStack>
    ),
    compactLeading: (
      <Image
        systemName={iconName}
        color={accent}
        size={16}
        modifiers={[frame({ width: 20, height: 20 })]}
      />
    ),
    compactTrailing: compactTimer,
    minimal: (
      <Image
        systemName={iconName}
        color={accent}
        size={14}
        modifiers={[frame({ width: 18, height: 18 })]}
      />
    ),
    expandedLeading: (
      <VStack spacing={4} modifiers={[padding({ all: 8 })]}>
        <Image systemName={iconName} color={accent} size={18} />
        <Text modifiers={[font({ size: 11 }), foregroundStyle(secondary)]}>{props.title}</Text>
      </VStack>
    ),
    expandedTrailing: (
      <VStack spacing={2} modifiers={[padding({ all: 8 })]}>
        {timer}
      </VStack>
    ),
    expandedBottom: <VStack modifiers={[padding({ all: 10 })]}>{actions}</VStack>,
  };
};

export default createLiveActivity('SleepLiveActivity', SleepLiveActivityLayout);

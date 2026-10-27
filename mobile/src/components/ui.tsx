import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatDisplayDate, todayISO } from '../lib/format';

export const colors = {
  bg: '#f0f4f8',
  ink: '#1a2740',
  inkSoft: '#243b55',
  muted: '#5d738c',
  faint: '#7a95b0',
  line: '#d5e0ea',
  card: '#ffffff',
  amber: '#f59e0b',
  danger: '#991b1b',
  dangerBg: '#fee2e2',
  ok: '#166534',
  okBg: '#dcfce7',
  blue: '#1e40af',
  blueBg: '#dbeafe',
  slateBg: '#e8eef5',
  amberSoft: '#fffbeb',
  inputBg: '#f8fafc',
  label: '#4a5568',
};

export const cardShadow = {
  shadowColor: '#1a2740',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.1,
  shadowRadius: 10,
  elevation: 3,
};

export function ScreenFrame({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView style={styles.frame} edges={['top', 'left', 'right']}>
      {children}
    </SafeAreaView>
  );
}

const logo = require('../../assets/iqra-logo.png');

export function BrandLogo({ height = 56 }: { height?: number }) {
  return (
    <Image
      source={logo}
      accessibilityLabel="Iqra Construction"
      resizeMode="contain"
      style={{ width: Math.round(height * (338 / 435)), height }}
    />
  );
}

export function AppHeader({
  title,
  subtitle,
  onBack,
  action,
  showLogo,
}: {
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  action?: { label: string; onPress: () => void };
  showLogo?: boolean;
}) {
  return (
    <LinearGradient colors={['#1a2740', '#243b55']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
      <View style={styles.headerRow}>
        {onBack ? (
          <Pressable onPress={onBack} hitSlop={12} style={styles.backBtn}>
            <Text style={styles.backIcon}>‹</Text>
          </Pressable>
        ) : (
          <BrandLogo height={44} />
        )}
        <View style={styles.headerText}>
          {showLogo ? null : <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>}
          {subtitle ? <Text style={styles.headerSub} numberOfLines={1}>{subtitle}</Text> : null}
        </View>
        {action ? (
          <Pressable onPress={action.onPress} hitSlop={8} style={styles.headerPill}>
            <Text style={styles.headerPillText}>{action.label}</Text>
          </Pressable>
        ) : null}
      </View>
    </LinearGradient>
  );
}

export function FormCard({ icon, title, children }: { icon: string; title: string; children: ReactNode }) {
  return (
    <View style={styles.formCard}>
      <View style={styles.formCardHeader}>
        <Text style={styles.formCardIcon}>{icon}</Text>
        <Text style={styles.formCardTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

export function Body({ children }: { children: ReactNode }) {
  return <View style={styles.body}>{children}</View>;
}

export function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>
        {label}{required ? <Text style={styles.required}> *</Text> : null}
      </Text>
      {children}
    </View>
  );
}

export function TextField(props: TextInputProps) {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      placeholderTextColor={colors.faint}
      {...props}
      onFocus={(event) => {
        setFocused(true);
        props.onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocused(false);
        props.onBlur?.(event);
      }}
      style={[styles.input, focused && styles.inputFocus, props.style]}
    />
  );
}

export function ChoiceRow({
  options,
  value,
  onChange,
}: {
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <View style={styles.choices}>
      {options.map((option) => {
        const selected = option === value;
        return (
          <Pressable
            key={option}
            onPress={() => onChange(option)}
            style={[styles.choice, selected && styles.choiceOn]}
          >
            <Text style={[styles.choiceText, selected && styles.choiceTextOn]}>{option}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function DateField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  if (Platform.OS === 'web') {
    return (
      <TextField
        value={value}
        onChangeText={onChange}
        placeholder="YYYY-MM-DD"
        autoCapitalize="none"
      />
    );
  }

  const DateTimePicker = require('@react-native-community/datetimepicker').default as typeof import('@react-native-community/datetimepicker').default;
  const current = value ? new Date(`${value}T12:00:00`) : new Date();
  return (
    <View>
      <Pressable onPress={() => setOpen(true)} style={styles.input}>
        <Text style={value ? styles.inputText : styles.placeholder}>
          {value ? formatDisplayDate(value) : 'Select date'}
        </Text>
      </Pressable>
      {open ? (
        <DateTimePicker
          value={current}
          mode="date"
          maximumDate={new Date(`${todayISO()}T12:00:00`)}
          onChange={(_event: unknown, date?: Date) => {
            if (Platform.OS === 'android') setOpen(false);
            if (!date) return;
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            onChange(`${date.getFullYear()}-${month}-${day}`);
            if (Platform.OS === 'ios') setOpen(false);
          }}
        />
      ) : null}
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  busy,
  tone = 'ink',
}: {
  label: string;
  onPress: () => void;
  busy?: boolean;
  tone?: 'ink' | 'danger';
}) {
  const gradient = tone === 'danger' ? ['#b91c1c', '#991b1b'] : ['#f59e0b', '#d97706'];
  return (
    <Pressable onPress={onPress} disabled={busy} style={({ pressed }) => [pressed && styles.buttonPressed, busy && styles.buttonBusy]}>
      <LinearGradient colors={gradient as [string, string]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.button}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{label}</Text>}
      </LinearGradient>
    </Pressable>
  );
}

export function Notice({ kind, text }: { kind: 'error' | 'success'; text: string }) {
  if (!text) return null;
  return (
    <View style={[styles.notice, kind === 'error' ? styles.noticeError : styles.noticeOk]}>
      <Text style={[styles.noticeText, kind === 'error' ? styles.noticeTextError : styles.noticeTextOk]}>{text}</Text>
    </View>
  );
}

export function Card({ children, onPress }: { children: ReactNode; onPress?: () => void }) {
  if (!onPress) return <View style={styles.card}>{children}</View>;
  return (
    <Pressable onPress={onPress} style={styles.card}>
      {children}
    </Pressable>
  );
}

export function EmptyText({ text }: { text: string }) {
  return <Text style={styles.empty}>{text}</Text>;
}

export function LoadingBlock() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.ink} size="large" />
    </View>
  );
}

export function FormScroll({ children }: { children: ReactNode }) {
  return (
    <ScrollView
      style={styles.body}
      contentContainerStyle={styles.formContent}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

export function statusColors(status: string) {
  if (status === 'Approved' || status === 'Completed' || status === 'Paid') {
    return { bg: colors.okBg, text: colors.ok };
  }
  if (status === 'Sent' || status === 'In Progress') {
    return { bg: colors.blueBg, text: colors.blue };
  }
  if (status === 'Rejected' || status === 'Expired' || status === 'Unpaid') {
    return { bg: colors.dangerBg, text: colors.danger };
  }
  return { bg: colors.slateBg, text: colors.inkSoft };
}

export function Badge({ label }: { label: string }) {
  const tone = statusColors(label);
  return (
    <View style={[styles.badge, { backgroundColor: tone.bg }]}>
      <Text style={[styles.badgeText, { color: tone.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1, backgroundColor: colors.ink },
  body: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerText: { flex: 1, justifyContent: 'center' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  headerSub: { color: '#a3b8cc', fontSize: 13, marginTop: 2 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  backIcon: { color: '#fff', fontSize: 28, lineHeight: 30, marginTop: -2 },
  headerPill: { backgroundColor: colors.amber, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, minHeight: 36, justifyContent: 'center' },
  headerPillText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  formCard: { backgroundColor: colors.card, borderRadius: 16, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 22, ...cardShadow },
  formCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#e9edf2' },
  formCardIcon: { fontSize: 22 },
  formCardTitle: { color: colors.ink, fontSize: 18, fontWeight: '800' },
  field: { marginBottom: 16 },
  label: { color: colors.label, fontSize: 12, fontWeight: '700', marginBottom: 6, letterSpacing: 0.4, textTransform: 'uppercase' },
  required: { color: '#e53e3e' },
  input: {
    backgroundColor: colors.inputBg,
    borderWidth: 1.5,
    borderColor: '#d1dce8',
    borderRadius: 10,
    paddingHorizontal: 13,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.ink,
  },
  inputFocus: { borderColor: colors.amber, backgroundColor: '#fff', borderWidth: 1.5 },
  inputText: { color: colors.ink, fontSize: 16 },
  placeholder: { color: colors.faint, fontSize: 16 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: {
    borderWidth: 1.5,
    borderColor: '#d1dce8',
    backgroundColor: colors.card,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  choiceOn: { backgroundColor: colors.amberSoft, borderColor: colors.amber },
  choiceText: { color: colors.label, fontWeight: '700' },
  choiceTextOn: { color: '#92400e' },
  button: {
    borderRadius: 12,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    ...cardShadow,
  },
  buttonPressed: { opacity: 0.92, transform: [{ translateY: -1 }] },
  buttonBusy: { opacity: 0.65 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  notice: { borderRadius: 10, padding: 12, marginBottom: 14, borderWidth: 1 },
  noticeError: { backgroundColor: '#fff5f5', borderColor: '#feb2b2' },
  noticeOk: { backgroundColor: '#f0fff4', borderColor: '#9ae6b4' },
  noticeText: { fontSize: 14, fontWeight: '600' },
  noticeTextError: { color: '#c53030' },
  noticeTextOk: { color: '#276749' },
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    ...cardShadow,
  },
  empty: { color: colors.muted, textAlign: 'center', marginVertical: 28, fontSize: 15 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  formContent: { padding: 16, paddingBottom: 40 },
  badge: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 12, fontWeight: '700' },
});

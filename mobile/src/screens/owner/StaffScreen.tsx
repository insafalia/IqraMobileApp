import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { AppHeader, Body, EmptyText, Field, FormScroll, Notice, PrimaryButton, ScreenFrame, TextField, colors } from '../../components/ui';
import { errorText } from '../../lib/format';
import { supabase } from '../../lib/supabase';
import type { Profile } from '../../lib/types';

const FLAGS = [
  ['can_add_payment', 'Add amount'],
  ['can_add_job', 'Add job'],
  ['can_add_material', 'Add material'],
  ['can_add_attendance', 'Add attendance'],
] as const;

export function StaffScreen() {
  const [staff, setStaff] = useState<Profile[]>([]);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [flags, setFlags] = useState({ can_add_payment: false, can_add_job: false, can_add_material: false, can_add_attendance: false });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data, error: loadError } = await supabase.from('profiles').select('*').eq('role', 'staff').order('display_name');
    if (loadError) setError(errorText(loadError));
    else setStaff((data ?? []) as Profile[]);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function updateStaff(person: Profile, patch: Partial<Profile>) {
    const { error: updateError } = await supabase.from('profiles').update(patch).eq('id', person.id);
    if (updateError) setError(errorText(updateError));
    else {
      setError('');
      load();
    }
  }

  async function create() {
    setError('');
    setSuccess('');
    if (!name.trim() || !email.trim() || password.length < 6) {
      setError('Enter a name, email, and a password of at least 6 characters.');
      return;
    }
    setBusy(true);
    const created = await supabase.rpc('create_staff', {
      staff_email: email.trim(),
      staff_password: password,
      staff_name: name.trim(),
      staff_phone: phone.trim() || null,
    });
    if (created.error || !created.data) {
      setBusy(false);
      setError(errorText(created.error || new Error('Could not create the login')));
      return;
    }
    const updated = await supabase.from('profiles').update(flags).eq('id', created.data);
    setBusy(false);
    if (updated.error) return setError(errorText(updated.error));
    setCreating(false);
    setName('');
    setPhone('');
    setEmail('');
    setPassword('');
    setFlags({ can_add_payment: false, can_add_job: false, can_add_material: false, can_add_attendance: false });
    setSuccess('Staff login created.');
    load();
  }

  if (creating) {
    return (
      <ScreenFrame>
        <AppHeader title="New staff" onBack={() => setCreating(false)} />
        <Body>
          <FormScroll>
            <Notice kind="error" text={error} />
            <Field label="Name" required><TextField value={name} onChangeText={setName} /></Field>
            <Field label="Phone"><TextField value={phone} onChangeText={setPhone} keyboardType="phone-pad" /></Field>
            <Field label="Email" required><TextField value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" /></Field>
            <Field label="Password" required><TextField value={password} onChangeText={setPassword} secureTextEntry /></Field>
            {FLAGS.map(([key, label]) => (
              <View key={key} style={styles.switchRow}>
                <Text style={styles.switchLabel}>{label}</Text>
                <Switch value={flags[key]} onValueChange={(value) => setFlags({ ...flags, [key]: value })} />
              </View>
            ))}
            <PrimaryButton label="Create login" onPress={create} busy={busy} />
          </FormScroll>
        </Body>
      </ScreenFrame>
    );
  }

  return (
    <ScreenFrame>
      <AppHeader title="Staff" subtitle="Turn actions on or off" action={{ label: 'Add', onPress: () => { setError(''); setCreating(true); } }} />
      <Body>
        <ScrollView contentContainerStyle={styles.content}>
          <Notice kind="error" text={error} />
          <Notice kind="success" text={success} />
          {staff.length === 0 ? <EmptyText text="No staff logins yet" /> : staff.map((person) => (
            <View key={person.id} style={styles.card}>
              <View style={styles.titleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{person.display_name}</Text>
                  <Text style={styles.meta}>{person.phone || 'No phone'}</Text>
                </View>
                <Pressable onPress={() => updateStaff(person, { active: !person.active })}>
                  <Text style={styles.link}>{person.active ? 'Turn off' : 'Turn on'}</Text>
                </Pressable>
              </View>
              {FLAGS.map(([key, label]) => (
                <View key={key} style={styles.switchRow}>
                  <Text style={styles.switchLabel}>{label}</Text>
                  <Switch value={person[key]} onValueChange={(value) => updateStaff(person, { [key]: value })} disabled={!person.active} />
                </View>
              ))}
            </View>
          ))}
        </ScrollView>
      </Body>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32 },
  card: { backgroundColor: colors.card, borderRadius: 16, padding: 14, marginBottom: 12, shadowColor: '#1a2740', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  name: { color: colors.ink, fontWeight: '800', fontSize: 16 },
  meta: { color: colors.muted, marginTop: 2 },
  link: { color: colors.amber, fontWeight: '800' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 },
  switchLabel: { color: colors.inkSoft, fontSize: 15 },
});

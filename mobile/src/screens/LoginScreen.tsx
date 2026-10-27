import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';
import { errorText } from '../lib/format';
import { supabase } from '../lib/supabase';
import { Body, BrandLogo, Field, FormScroll, Notice, PrimaryButton, ScreenFrame, TextField, colors } from '../components/ui';

export function LoginScreen() {
  const { notice } = useAuth();
  const [checking, setChecking] = useState(true);
  const [hasOwner, setHasOwner] = useState(true);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.rpc('has_owner').then(({ data, error: rpcError }) => {
      if (rpcError) setError(errorText(rpcError));
      setHasOwner(Boolean(data));
      setChecking(false);
    });
  }, []);

  async function submit() {
    setError('');
    if (!email.trim() || password.length < 6) {
      setError('Enter an email and a password of at least 6 characters.');
      return;
    }
    setBusy(true);
    try {
      if (!hasOwner) {
        if (!name.trim()) {
          setError('Enter the owner name.');
          return;
        }
        const created = await supabase.rpc('create_owner', {
          owner_email: email.trim(),
          owner_password: password,
          owner_name: name.trim(),
          owner_phone: phone.trim() || null,
        });
        if (created.error) {
          setError(errorText(created.error));
          return;
        }
      }
      const signedIn = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signedIn.error) setError(errorText(signedIn.error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScreenFrame>
      <LinearGradient colors={['#1a2740', '#243b55']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.brand}>
        <BrandLogo height={92} />
        <Text style={styles.brandSub}>{hasOwner ? 'Sign in' : 'Create the owner login'}</Text>
      </LinearGradient>
      <Body>
        <FormScroll>
          {checking ? <Text style={styles.hint}>Checking the account...</Text> : null}
          <Notice kind="error" text={notice || error} />
          {!hasOwner ? (
            <>
              <Field label="Owner name" required>
                <TextField value={name} onChangeText={setName} placeholder="Your name" />
              </Field>
              <Field label="Phone">
                <TextField value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="Phone" />
              </Field>
            </>
          ) : null}
          <Field label="Email" required>
            <TextField
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="name@email.com"
            />
          </Field>
          <Field label="Password" required>
            <TextField
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="At least 6 characters"
            />
          </Field>
          <PrimaryButton
            label={hasOwner ? 'Sign in' : 'Create owner and sign in'}
            onPress={submit}
            busy={busy || checking}
          />
        </FormScroll>
      </Body>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  brand: { paddingHorizontal: 24, paddingBottom: 22, alignItems: 'flex-start' },
  brandSub: { color: '#a3b8cc', marginTop: 10, fontSize: 15 },
  hint: { color: colors.muted, marginBottom: 12 },
});

import React, { useState } from "react";
import { View } from "react-native";
import { Button, Text, TextInput } from "react-native-paper";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../App";
import { apiFetch, saveToken, saveBase, DEFAULT_BASE } from "../lib/api";

export type Props = NativeStackScreenProps<RootStackParamList, "Login">;

export default function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState("voce@empresa.com");
  const [password, setPassword] = useState("");
  const [base, setBase] = useState(DEFAULT_BASE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const doLogin = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      if (res?.access_token) {
        await saveToken(res.access_token);
        await saveBase(base);
        navigation.replace("FaceClock");
      } else {
        setError("Login inválido");
      }
    } catch (err: any) {
      setError(err.message || "Erro no login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, padding: 20, justifyContent: "center", backgroundColor: "#0f172a" }}>
      <Text style={{ color: "white", fontSize: 24, marginBottom: 16 }}>Finance + HR</Text>
      <TextInput label="API Base" value={base} onChangeText={setBase} autoCapitalize="none" style={{ marginBottom: 8 }} />
      <TextInput label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" style={{ marginBottom: 8 }} />
      <TextInput label="Senha" value={password} onChangeText={setPassword} secureTextEntry style={{ marginBottom: 16 }} />
      <Button mode="contained" onPress={doLogin} loading={loading}>Entrar</Button>
      {error ? <Text style={{ color: "tomato", marginTop: 12 }}>{error}</Text> : null}
    </View>
  );
}

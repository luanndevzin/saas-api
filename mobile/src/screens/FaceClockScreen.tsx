import React, { useEffect, useRef, useState } from "react";
import { View, StyleSheet, Alert } from "react-native";
import { Button, Text } from "react-native-paper";
import { Camera, CameraType } from "expo-camera";
import { apiFetch, clearToken, loadBase } from "../lib/api";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../App";

export type Props = NativeStackScreenProps<RootStackParamList, "FaceClock">;

type FaceClockResponse = {
  employee_id: number;
  clock_in?: string;
  clock_out?: string;
  match?: boolean;
  distance?: number;
};

export default function FaceClockScreen({ navigation }: Props) {
  const cameraRef = useRef<Camera | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");

  useEffect(() => {
    Camera.requestCameraPermissionsAsync().then((res) => setHasPermission(res.status === "granted"));
  }, []);

  const logout = async () => {
    await clearToken();
    navigation.replace("Login");
  };

  const captureAndClock = async () => {
    if (!cameraRef.current) {
      Alert.alert("Erro", "Câmera não inicializada");
      return;
    }
    setLoading(true);
    setResult("");
    try {
      const shot = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.7 });
      if (!shot?.base64) throw new Error("Falha ao capturar imagem");
      const payload = { image_base64: `data:image/jpeg;base64,${shot.base64}`, note: "facial mobile" };
      const data = await apiFetch("/face/clock", { method: "POST", body: JSON.stringify(payload) }) as FaceClockResponse;
      const action = data.clock_out ? "Saída" : "Entrada";
      const when = data.clock_out || data.clock_in;
      setResult(`${action} registrada (${when}) dist=${data.distance ?? "?"}`);
    } catch (err: any) {
      Alert.alert("Erro", err.message || "Falha ao bater ponto");
    } finally {
      setLoading(false);
    }
  };

  if (hasPermission === false) {
    return <View style={styles.container}><Text>Permissão de câmera negada.</Text></View>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={{ color: "white", fontSize: 18 }}>Bater ponto (face)</Text>
        <Button mode="text" onPress={logout} textColor="#93c5fd">Sair</Button>
      </View>
      <Camera ref={cameraRef} style={styles.camera} type={CameraType.front} ratio="16:9" />
      <Button mode="contained" onPress={captureAndClock} loading={loading} style={{ marginTop: 12 }}>
        Registrar face e bater ponto
      </Button>
      {result ? <Text style={{ color: "#a3e635", marginTop: 12 }}>{result}</Text> : null}
      <Text style={{ color: "#9ca3af", marginTop: 8 }}>Aponte o rosto para a câmera; o app identifica o colaborador e abre/fecha o ponto.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a", padding: 16 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  camera: { width: "100%", height: 380, borderRadius: 12, overflow: "hidden" },
});

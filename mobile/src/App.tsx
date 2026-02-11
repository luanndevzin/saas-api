import React, { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Provider as PaperProvider } from "react-native-paper";
import LoginScreen from "./screens/LoginScreen";
import FaceClockScreen from "./screens/FaceClockScreen";
import { loadToken } from "./lib/api";

export type RootStackParamList = {
  Login: undefined;
  FaceClock: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const [initialRoute, setInitialRoute] = useState<keyof RootStackParamList>("Login");

  useEffect(() => {
    loadToken().then((t) => {
      if (t) setInitialRoute("FaceClock");
    });
  }, []);

  return (
    <PaperProvider>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName={initialRoute}>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="FaceClock" component={FaceClockScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </PaperProvider>
  );
}

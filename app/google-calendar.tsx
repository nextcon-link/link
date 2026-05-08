import { Redirect, useLocalSearchParams } from "expo-router";

export default function GoogleCalendarRedirect() {
  const params = useLocalSearchParams();

  return (
    <Redirect
      href={{
        pathname: "/google",
        params,
      }}
    />
  );
}

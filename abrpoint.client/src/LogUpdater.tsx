import useGetDmPoint from "./hooks/pointeuseHooks/useGetDmPoint";

export default function LogUpdater() {
  // Just calling the hook starts the loop
  useGetDmPoint();

  return null; // no UI needed
}

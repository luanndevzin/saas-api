import { ReactNode, useEffect, useMemo, useState } from "react";
import { NavLink as RouterNavLink, useLocation, useNavigate } from "react-router-dom";
import { useDisclosure } from "@mantine/hooks";
import {
  ActionIcon,
  AppShell,
  Box,
  Burger,
  Button,
  Card,
  Divider,
  Group,
  NavLink as MantineNavLink,
  ScrollArea,
  Stack,
  Text,
  ThemeIcon,
} from "@mantine/core";
import {
  Briefcase,
  ChevronDown,
  CircleDot,
  Clock3,
  Headset,
  LayoutDashboard,
  LogOut,
  MoonStar,
  PlugZap,
  Receipt,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";
import { useApi } from "../lib/api-provider";
import { useToast } from "./toast";

interface NavItem {
  label: string;
  to: string;
  icon: ReactNode;
  section: string;
  description: string;
  roles?: string[];
  children?: Array<{
    label: string;
    to: string;
    description?: string;
    tab?: "estrutura" | "colaboradores" | "folgas" | "ponto" | "banco";
  }>;
}

const navItems: NavItem[] = [
  {
    label: "Dashboard",
    to: "/dashboard",
    icon: <LayoutDashboard className="h-4 w-4" />,
    section: "Principal",
    description: "Visao consolidada de caixa e performance",
    roles: ["owner", "finance"],
  },
  {
    label: "Finance AP",
    to: "/finance/ap",
    icon: <Wallet className="h-4 w-4" />,
    section: "Financeiro",
    description: "Contas a pagar, aprovacoes e pagamentos",
    roles: ["owner", "finance"],
  },
  {
    label: "Finance AR",
    to: "/finance/ar",
    icon: <Receipt className="h-4 w-4" />,
    section: "Financeiro",
    description: "Contas a receber e cobranca",
    roles: ["owner", "finance"],
  },
  {
    label: "RH",
    to: "/hr",
    icon: <Briefcase className="h-4 w-4" />,
    section: "Pessoas",
    description: "Estrutura, colaboradores e beneficios",
    roles: ["owner", "hr"],
    children: [
      { label: "Estrutura", to: "/hr?secao=estrutura", tab: "estrutura" },
      { label: "Colaboradores", to: "/hr?secao=colaboradores", tab: "colaboradores" },
      { label: "Folgas e beneficios", to: "/hr?secao=folgas", tab: "folgas" },
      { label: "Ponto (Clockify)", to: "/hr?secao=ponto", tab: "ponto" },
      { label: "Banco de horas", to: "/hr?secao=banco", tab: "banco" },
    ],
  },
  {
    label: "Meu Ponto",
    to: "/ponto",
    icon: <Clock3 className="h-4 w-4" />,
    section: "Pessoas",
    description: "Bater entrada e saida e ver historico",
    roles: ["colaborador", "member"],
  },
  {
    label: "Members",
    to: "/members",
    icon: <Users className="h-4 w-4" />,
    section: "Admin",
    description: "Governanca de acesso por tenant",
    roles: ["owner"],
  },
];

function pathMatches(pathname: string, to: string) {
  const targetPath = to.split("?")[0];
  if (targetPath === "/dashboard") return pathname === "/dashboard";
  return pathname === targetPath || pathname.startsWith(`${targetPath}/`);
}

function readHRSection(search: string): "estrutura" | "colaboradores" | "folgas" | "ponto" | "banco" {
  const value = new URLSearchParams(search).get("secao");
  if (value === "colaboradores" || value === "folgas" || value === "ponto" || value === "banco") return value;
  return "estrutura";
}

function roleLabel(role?: string) {
  switch (role) {
    case "owner":
      return "Owner";
    case "hr":
      return "RH";
    case "finance":
      return "Financeiro";
    case "colaborador":
    case "member":
      return "Colaborador";
    default:
      return "Visitante";
  }
}

export function Shell({ children }: { children: ReactNode }) {
  const { baseUrl, me, logout, request, token } = useApi();
  const { toast } = useToast();
  const [checking, setChecking] = useState(false);
  const [mobileOpened, { toggle, close }] = useDisclosure(false);
  const [hrMenuOpened, setHrMenuOpened] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const filteredNav = useMemo(() => {
    if (!me) return navItems;
    return navItems.filter((item) => !item.roles || item.roles.includes(me.role));
  }, [me]);

  const groupedNav = useMemo(() => {
    return filteredNav.reduce<Record<string, NavItem[]>>((acc, item) => {
      if (!acc[item.section]) acc[item.section] = [];
      acc[item.section].push(item);
      return acc;
    }, {});
  }, [filteredNav]);

  const activeItem = useMemo(() => {
    return filteredNav.find((item) => pathMatches(location.pathname, item.to)) || null;
  }, [filteredNav, location.pathname]);

  const activeHRSection = useMemo(() => readHRSection(location.search), [location.search]);

  useEffect(() => {
    if (location.pathname === "/hr") {
      setHrMenuOpened(true);
    }
  }, [location.pathname]);

  const handleHealth = async () => {
    setChecking(true);
    try {
      const data = await request<{ status: string }>("/health", { auth: false });
      toast({ title: "API ok", description: JSON.stringify(data), variant: "success" });
    } catch (err: any) {
      toast({ title: "Health check falhou", description: err.message, variant: "error" });
    } finally {
      setChecking(false);
    }
  };

  const goPrimaryAction = () => {
    if (me?.role === "colaborador" || me?.role === "member") {
      navigate("/ponto");
      return;
    }
    if (me?.role === "hr") {
      navigate("/hr");
      return;
    }
    if (me?.role === "finance") {
      navigate("/finance/ap");
      return;
    }
    navigate("/dashboard");
  };

  const canCheckApi = me?.role === "owner";

  const handleLogout = () => {
    close();
    logout();
  };

  return (
    <AppShell
      padding="md"
      layout="alt"
      header={{ height: 72 }}
      navbar={{
        width: 320,
        breakpoint: "md",
        collapsed: { mobile: !mobileOpened },
      }}
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            <Burger opened={mobileOpened} onClick={toggle} hiddenFrom="md" size="sm" />
            <ThemeIcon size={34} radius="xl" variant="gradient" gradient={{ from: "cyan", to: "blue" }}>
              <ShieldCheck className="h-4 w-4" />
            </ThemeIcon>
            <Box>
              <Text fw={700} size="sm">
                {activeItem?.label || "SaaS Control"}
              </Text>
              <Text size="xs" c="dimmed">
                {activeItem?.description || "Navegacao principal"}
              </Text>
            </Box>
          </Group>

          <Group gap="xs" wrap="nowrap">
            {me ? (
              <>
                <Text size="sm" c="dimmed">
                  {roleLabel(me.role)}
                </Text>
                <ActionIcon variant="light" color="red" onClick={handleLogout} title="Sair">
                  <LogOut className="h-4 w-4" />
                </ActionIcon>
              </>
            ) : (
              <Button size="xs" variant="light" onClick={() => navigate("/login")}>
                Entrar
              </Button>
            )}
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="sm">
        <AppShell.Section>
          <Card withBorder radius="md" p="sm" bg="dark.6">
            <Group justify="space-between" wrap="nowrap">
              <Group gap="sm" wrap="nowrap">
                <ThemeIcon size={34} radius="xl" variant="gradient" gradient={{ from: "cyan", to: "blue" }}>
                  <Text fw={700} size="xs">{me ? `T${me.tenantId}` : "SC"}</Text>
                </ThemeIcon>
                <Box>
                  <Text size="sm" fw={700}>{me ? `Tenant ${me.tenantId}` : "Workspace"}</Text>
                  <Group gap={4} align="center">
                    <CircleDot className="h-3 w-3 text-emerald-500 fill-emerald-500" />
                    <Text size="xs" c="dimmed">{roleLabel(me?.role)}</Text>
                  </Group>
                </Box>
              </Group>
              <ActionIcon variant="subtle" color="gray">
                <ChevronDown className="h-4 w-4" />
              </ActionIcon>
            </Group>
          </Card>
        </AppShell.Section>

        <AppShell.Section grow component={ScrollArea} mt="md">
          <Stack gap="sm" pr={4}>
            {Object.entries(groupedNav).map(([section, items]) => (
              <Box key={section}>
                <Group justify="space-between" mb={6} px={4}>
                  <Text size="xs" fw={700} c="dimmed" tt="uppercase">{section}</Text>
                  <ChevronDown className="h-3 w-3 text-gray-400" />
                </Group>
                <Stack gap={4}>
                  {items.map((item) => {
                    const active = pathMatches(location.pathname, item.to);
                    const hasChildren = Array.isArray(item.children) && item.children.length > 0;
                    const isHREntry = item.to === "/hr";
                    const isOpen = isHREntry ? hrMenuOpened : false;

                    if (hasChildren) {
                      return (
                        <MantineNavLink
                          key={item.to}
                          variant={active ? "filled" : "subtle"}
                          color={active ? "cyan" : "gray"}
                          label={item.label}
                          description={item.description}
                          leftSection={item.icon}
                          active={active}
                          opened={isOpen}
                          childrenOffset={16}
                          onClick={() => {
                            if (isHREntry) {
                              setHrMenuOpened((prev) => !prev);
                              if (location.pathname !== "/hr") {
                                navigate("/hr?secao=estrutura");
                              }
                            }
                          }}
                          rightSection={
                            <ChevronDown className={`h-3 w-3 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                          }
                          styles={{
                            root: {
                              borderRadius: 10,
                            },
                            description: {
                              lineHeight: 1.2,
                              opacity: 0.8,
                            },
                          }}
                        >
                          {item.children!.map((child) => {
                            const childActive =
                              isHREntry && location.pathname === "/hr"
                                ? activeHRSection === child.tab
                                : pathMatches(location.pathname, child.to);

                            return (
                              <MantineNavLink
                                key={child.to}
                                component={RouterNavLink}
                                to={child.to}
                                onClick={close}
                                label={child.label}
                                description={child.description}
                                active={childActive}
                                color={childActive ? "cyan" : "gray"}
                                variant={childActive ? "light" : "subtle"}
                                styles={{
                                  root: {
                                    borderRadius: 8,
                                  },
                                }}
                              />
                            );
                          })}
                        </MantineNavLink>
                      );
                    }

                    return (
                      <MantineNavLink
                        key={item.to}
                        component={RouterNavLink}
                        to={item.to}
                        onClick={close}
                        variant={active ? "filled" : "subtle"}
                        color={active ? "cyan" : "gray"}
                        label={item.label}
                        description={item.description}
                        leftSection={item.icon}
                        active={active}
                        styles={{
                          root: {
                            borderRadius: 10,
                          },
                          description: {
                            lineHeight: 1.2,
                            opacity: 0.8,
                          },
                        }}
                      />
                    );
                  })}
                </Stack>
              </Box>
            ))}
          </Stack>
        </AppShell.Section>

        <AppShell.Section>
          <Divider my="xs" />
          <Card withBorder radius="md" p="sm" bg="dark.6" mb="sm">
            <Group justify="space-between" mb={8}>
              <Text size="xs" c="dimmed">Conexao API</Text>
              <PlugZap className="h-4 w-4 text-cyan-400" />
            </Group>
            <Text size="xs" truncate mb="sm">{baseUrl}</Text>
            <Group grow>
              <Button size="xs" onClick={goPrimaryAction}>Abrir modulo</Button>
              {canCheckApi && (
                <Button size="xs" variant="outline" onClick={handleHealth} loading={checking}>
                  Check
                </Button>
              )}
            </Group>
          </Card>

          <Group justify="space-between" px={4}>
            <Group gap={6}><Headset className="h-4 w-4" /><Text size="xs" c="dimmed">Suporte</Text></Group>
            <Group gap={6}><MoonStar className="h-4 w-4" /><Text size="xs" c="dimmed">Dark</Text></Group>
          </Group>
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main>
        <div className="container h-[calc(100vh-96px)] overflow-y-auto py-2 md:py-4">
          {!token && (
            <Card withBorder radius="md" p="md" mb="md" bg="dark.6">
              <Group justify="space-between">
                <Text size="sm" c="dimmed">Use Login ou Registro para obter token e acesso completo.</Text>
                <Group>
                  <Button size="xs" onClick={() => navigate("/login")}>Ir para Login</Button>
                  <Button size="xs" variant="outline" onClick={() => navigate("/register")}>Registrar</Button>
                </Group>
              </Group>
            </Card>
          )}
          {children}
        </div>
      </AppShell.Main>
    </AppShell>
  );
}

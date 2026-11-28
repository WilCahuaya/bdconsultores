import { useEffect, useState } from "react";
import { ActivoEditScopeNav, type ActivoEditScope } from "@inventario/ui/panel";
import { ActivoFormDesktop, type ActivoFormDesktopProps } from "./ActivoFormDesktop";
import { useEjemplaresResumen } from "../hooks/useEjemplaresResumen";

type ActivoEditWithScopeDesktopProps = Omit<
  ActivoFormDesktopProps,
  "editScope" | "ejemplaresTotal"
>;

export function ActivoEditWithScopeDesktop(props: ActivoEditWithScopeDesktopProps) {
  const { activo, seleccionIds, ...formProps } = props;
  const [editScope, setEditScope] = useState<ActivoEditScope>("single");
  const { resumen: ejemplares } = useEjemplaresResumen(activo?.id);
  const ejemplaresTotal = ejemplares?.total ?? 0;
  const edicionSeleccion = Boolean(seleccionIds && seleccionIds.length > 1);

  useEffect(() => {
    setEditScope("single");
  }, [activo?.id]);

  if (edicionSeleccion) {
    return (
      <ActivoFormDesktop
        {...formProps}
        activo={activo}
        editScope="bulk"
        ejemplaresTotal={seleccionIds!.length}
        seleccionIds={seleccionIds}
      />
    );
  }

  return (
    <div className="space-y-4">
      <ActivoEditScopeNav
        scope={editScope}
        ejemplaresTotal={ejemplaresTotal}
        onScopeChange={setEditScope}
      />
      <ActivoFormDesktop
        {...formProps}
        activo={activo}
        editScope={editScope}
        ejemplaresTotal={ejemplaresTotal}
      />
    </div>
  );
}

// Utilitas navigasi untuk AppShell (setara dengan navUtils di BAAKSYS & SIRENA).
//
// Struktur NAV:
//   { section: 'Judul bagian' }
//   { id, label, icon, to, end? }                 -> item biasa
//   { id, label, icon, children: [ ...item ] }     -> modul (drill-in)
//   { ..., roles: ['admin'] }                      -> opsional, disaring filterNav

function cocok(to, pathname, end) {
  if (!to) return false;
  if (end === false) return pathname === to || pathname.startsWith(`${to}/`);
  return pathname === to;
}

export function firstLeaf(module) {
  return (module.children || []).find((c) => c.to) || null;
}

export function findActive(nav, pathname) {
  let terbaik = { module: null, item: null, panjang: -1 };
  for (const item of nav) {
    if (item.children) {
      for (const child of item.children) {
        if (child.to && (cocok(child.to, pathname, child.end) || pathname.startsWith(`${child.to}/`))
            && child.to.length > terbaik.panjang) {
          terbaik = { module: item, item: child, panjang: child.to.length };
        }
      }
    } else if (item.to && (cocok(item.to, pathname, item.end) || pathname.startsWith(`${item.to}/`))
               && item.to.length > terbaik.panjang) {
      terbaik = { module: null, item, panjang: item.to.length };
    }
  }
  return { module: terbaik.module, item: terbaik.item };
}

export function filterNav(nav, { role }) {
  const boleh = (n) => !n.roles || n.roles.includes(role);
  const hasil = [];
  for (const n of nav) {
    if (!boleh(n)) continue;
    if (n.children) {
      const anak = n.children.filter(boleh);
      if (anak.some((c) => c.to)) hasil.push({ ...n, children: anak });
    } else {
      hasil.push(n);
    }
  }
  // Buang judul bagian yang tidak diikuti item.
  return hasil.filter((n, i) => !n.section || (hasil[i + 1] && !hasil[i + 1].section));
}

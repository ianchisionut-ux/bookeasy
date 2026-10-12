import bpy
import math
import os
from mathutils import Vector


ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
BLEND_PATH = os.path.join(ROOT, "assets", "blender", "bookeasy-dental-chart.blend")
GLB_PATH = os.path.join(ROOT, "public", "models", "bookeasy-dental-chart.glb")
PREVIEW_PATH = os.path.join(ROOT, "output", "dental-model-preview.png")
TYPES_PREVIEW_PATH = os.path.join(ROOT, "output", "dental-tooth-types-preview.png")


def make_material(name, color, roughness):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    shader = next(node for node in material.node_tree.nodes if node.type == "BSDF_PRINCIPLED")
    shader.inputs["Base Color"].default_value = color
    shader.inputs["Roughness"].default_value = roughness
    return material


def finish_surface(obj, bevel=0.02, subdivision=1):
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    if subdivision:
        modifier = obj.modifiers.new("Organic crown smoothing", "SUBSURF")
        modifier.subdivision_type = "CATMULL_CLARK"
        modifier.levels = subdivision
        modifier.render_levels = subdivision
    if bevel:
        modifier = obj.modifiers.new("Natural edge softness", "BEVEL")
        modifier.width = bevel
        modifier.segments = 2


def superellipse(angle, exponent):
    power = 2.0 / exponent
    cosine = math.cos(angle)
    sine = math.sin(angle)
    return math.copysign(abs(cosine) ** power, cosine), math.copysign(abs(sine) ** power, sine)


def anterior_crown_mesh(name, width, depth, height, kind, upper, side):
    chewing_sign = -1 if upper else 1
    if kind == "canine":
        # Maxillary canine is bulkier with a stronger labial ridge; the
        # mandibular canine is narrower mesiodistally and slightly longer.
        profiles = (
            [(-0.50, 0.54, 0.63), (-0.36, 0.76, 0.82), (-0.15, 0.96, 0.98),
             (0.03, 1.00, 1.00), (0.22, 0.86, 0.88), (0.39, 0.50, 0.56), (0.51, 0.035, 0.055)]
            if upper else
            [(-0.50, 0.50, 0.58), (-0.35, 0.71, 0.77), (-0.13, 0.92, 0.94),
             (0.06, 1.00, 1.00), (0.25, 0.83, 0.84), (0.41, 0.46, 0.51), (0.52, 0.03, 0.05)]
        )
        exponent = 2.48 if upper else 2.72
    else:
        # Four separate canonical incisor silhouettes. Upper central is broad
        # and almost rectangular; upper lateral is rounder. Lower central is
        # the smallest and most symmetrical, while lower lateral twists distal.
        if upper and kind == "central":
            profiles = [(-0.50, 0.58, 0.66), (-0.36, 0.76, 0.83), (-0.16, 0.92, 0.95),
                        (0.04, 1.00, 1.00), (0.28, 1.00, 0.91), (0.46, 0.97, 0.73), (0.51, 0.94, 0.66)]
            exponent = 5.1
        elif upper:
            profiles = [(-0.50, 0.56, 0.64), (-0.36, 0.74, 0.82), (-0.16, 0.91, 0.95),
                        (0.05, 1.00, 1.00), (0.28, 0.98, 0.90), (0.45, 0.91, 0.72), (0.51, 0.84, 0.64)]
            exponent = 3.65
        elif kind == "central":
            profiles = [(-0.50, 0.53, 0.61), (-0.34, 0.72, 0.79), (-0.13, 0.91, 0.93),
                        (0.07, 1.00, 1.00), (0.30, 0.99, 0.90), (0.47, 0.96, 0.70), (0.51, 0.93, 0.64)]
            exponent = 5.2
        else:
            profiles = [(-0.50, 0.52, 0.61), (-0.35, 0.72, 0.80), (-0.14, 0.91, 0.94),
                        (0.06, 1.00, 1.00), (0.29, 0.99, 0.91), (0.46, 0.94, 0.72), (0.51, 0.88, 0.66)]
            exponent = 4.5

    ring_vertices = 40
    vertices = []
    faces = []
    for q, x_scale, y_scale in profiles:
        for segment in range(ring_vertices):
            angle = 2 * math.pi * segment / ring_vertices
            x_unit, y_unit = superellipse(angle, exponent)
            # Distal corners are more rounded and the crown leans subtly distally.
            distal_side = x_unit * side
            distal_rounding = 0.075 if kind == "lateral" else 0.045
            x_factor = 1.0 - distal_rounding * max(0.0, distal_side)
            distal_twist = side * width * (0.040 if (not upper and kind == "lateral") else 0.022) * (q + 0.5)
            x = width * 0.5 * x_scale * x_unit * x_factor + distal_twist
            if y_unit < 0:
                # Labial convexity and canine labial ridge.
                labial_ridge = 0.115 if kind == "canine" and upper else (0.085 if kind == "canine" else 0.042)
                bulge = 1.0 + labial_ridge * math.exp(-((q - 0.02) / 0.30) ** 2) * (1.0 - 0.22 * abs(x_unit))
                y = depth * 0.5 * y_scale * y_unit * bulge
            else:
                # Lingual surface tapers inward; incisors retain a real fossa.
                fossa = 0.82 if kind != "canine" and -0.12 < q < 0.34 else 0.91
                y = depth * 0.5 * y_scale * y_unit * fossa
            vertices.append((x, y, height * q * chewing_sign))

    for ring in range(len(profiles) - 1):
        current = ring * ring_vertices
        following_ring = (ring + 1) * ring_vertices
        for segment in range(ring_vertices):
            following = (segment + 1) % ring_vertices
            faces.append((current + segment, current + following, following_ring + following, following_ring + segment))
    first = tuple(range(ring_vertices - 1, -1, -1))
    last_start = (len(profiles) - 1) * ring_vertices
    last = tuple(last_start + segment for segment in range(ring_vertices))
    faces.extend((first, last))
    mesh = bpy.data.meshes.new(f"{name}_Crown")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    return mesh


def cusp_layout(kind, upper, tooth_index, side):
    mesial = -side
    distal = side
    if kind == "premolar":
        if not upper and tooth_index == 5:
            # Lower second premolar: common three-cusp Y pattern.
            return [(0.0, -0.56, 0.23), (mesial * 0.27, 0.46, 0.17), (distal * 0.27, 0.44, 0.15)]
        if upper and tooth_index == 4:
            return [(mesial * 0.03, -0.56, 0.25), (distal * 0.03, 0.49, 0.20)]
        if upper:
            return [(0.0, -0.54, 0.22), (0.0, 0.50, 0.21)]
        # Mandibular P1 has a dominant buccal cusp and a tiny, non-functional lingual cusp.
        return [(mesial * 0.02, -0.57, 0.27), (distal * 0.05, 0.42, 0.095)]
    if upper:
        if tooth_index == 8:
            return [(mesial * 0.39, -0.55, 0.20), (distal * 0.34, -0.51, 0.16), (mesial * 0.13, 0.45, 0.18)]
        if tooth_index == 7:
            return [(mesial * 0.43, -0.57, 0.22), (distal * 0.41, -0.53, 0.19),
                    (mesial * 0.37, 0.47, 0.24), (distal * 0.32, 0.43, 0.13)]
        # Maxillary molars are rhomboid: mesiopalatal is the largest cusp,
        # distopalatal the smallest, with two distinct buccal lobes.
        return [(mesial * 0.45, -0.58, 0.24), (distal * 0.43, -0.55, 0.20),
                (mesial * 0.39, 0.48, 0.27), (distal * 0.35, 0.44, 0.16)]
    if tooth_index == 6:
        # Lower first molar: characteristic five-cusp pattern.
        return [(mesial * 0.48, -0.54, 0.22), (0.0, -0.61, 0.23), (distal * 0.49, -0.49, 0.17),
                (mesial * 0.37, 0.49, 0.23), (distal * 0.36, 0.47, 0.21)]
    if tooth_index == 8:
        return [(mesial * 0.41, -0.54, 0.19), (distal * 0.40, -0.52, 0.18),
                (mesial * 0.35, 0.46, 0.19), (distal * 0.35, 0.44, 0.17), (0.0, 0.02, 0.09)]
    # Lower second molar: four similarly sized cusps and a cruciform groove.
    return [(mesial * 0.44, -0.56, 0.22), (distal * 0.44, -0.55, 0.21),
            (mesial * 0.39, 0.48, 0.22), (distal * 0.39, 0.47, 0.20)]


def posterior_outline(angle, kind, upper, tooth_index, side):
    """Return the canonical occlusal outline for a permanent posterior tooth.

    The model deliberately uses a separate outline for every premolar/molar
    archetype instead of scaling one generic rounded box.  X is mesiodistal,
    Y is buccolingual and ``side`` keeps mesial/distal anatomy mirrored.
    """
    if kind == "premolar":
        if upper and tooth_index == 4:
            exponent = 2.55  # angular maxillary P1, shallow mesial concavity
        elif upper:
            exponent = 2.25  # rounder maxillary P2
        elif tooth_index == 4:
            exponent = 1.72  # diamond-like mandibular P1
        else:
            exponent = 2.72  # broader mandibular P2
    elif upper:
        exponent = {6: 2.48, 7: 2.34, 8: 2.02}[tooth_index]
    else:
        exponent = {6: 2.46, 7: 2.68, 8: 2.30}[tooth_index]

    x, y = superellipse(angle, exponent)
    mesial = max(0.0, -x * side)
    distal = max(0.0, x * side)

    if kind == "premolar":
        if upper and tooth_index == 4:
            # Maxillary first premolar: hexagonal outline and mesial groove.
            x *= 1.0 - 0.055 * max(0.0, y) * mesial
            y *= 1.0 - 0.045 * distal
        elif upper:
            x *= 1.0 - 0.025 * distal
            y *= 1.0 - 0.025 * abs(x)
        elif tooth_index == 4:
            # Mandibular first premolar narrows markedly lingually.
            lingual = max(0.0, y)
            x *= 1.0 - 0.23 * lingual
            y *= 1.0 - 0.055 * distal
        else:
            y *= 1.0 - 0.035 * distal
    elif upper:
        # Maxillary molars have a rhomboid outline.  The distal-palatal corner
        # progressively reduces from M1 to M3; M3 becomes heart-shaped.
        x += -side * 0.075 * y
        distopalatal = distal * max(0.0, y)
        reduction = {6: 0.055, 7: 0.15, 8: 0.36}[tooth_index]
        x *= 1.0 - reduction * distopalatal
        y *= 1.0 - (reduction * 0.72) * distopalatal
        if tooth_index == 8:
            x *= 1.0 - 0.10 * max(0.0, y)
    else:
        # Mandibular M1 is pentagonal with a small distal lobe, M2 rectangular,
        # and M3 rounder with a reduced distal half.
        if tooth_index == 6:
            x *= 1.0 - 0.055 * distal
            y *= 1.0 - 0.040 * distal
        elif tooth_index == 8:
            x *= 1.0 - 0.13 * distal
            y *= 1.0 - 0.065 * distal

    return x, y


def posterior_crown_mesh(name, width, depth, height, kind, upper, tooth_index, side):
    chewing_sign = -1 if upper else 1
    ring_vertices = 48
    radial_rings = 13
    side_profiles = [
        (-0.50, 0.57, 0.64),
        (-0.38, 0.76, 0.81),
        (-0.19, 0.94, 0.95),
        (0.02, 1.00, 1.00),
        (0.16, 0.94, 0.93),
    ]
    vertices = []
    faces = []
    cusps = cusp_layout(kind, upper, tooth_index, side)

    def cusp_relief(x_norm, y_norm, spread=0.34):
        relief = 0.0
        for cusp_x, cusp_y, amplitude in cusps:
            distance = ((x_norm - cusp_x) / spread) ** 2 + ((y_norm - cusp_y) / spread) ** 2
            relief += amplitude * math.exp(-distance * 1.18)
        return relief

    outline_blend = (0.08, 0.18, 0.34, 0.58, 0.82)
    for profile_index, (q, x_scale, y_scale) in enumerate(side_profiles):
        for segment in range(ring_vertices):
            angle = 2 * math.pi * segment / ring_vertices
            outline_x, outline_y = posterior_outline(angle, kind, upper, tooth_index, side)
            # The occlusal table may be rhomboid/rectangular, but a real crown's
            # axial walls are convex and rounded. Blend from an ellipse at the
            # cervical margin into the type-specific outline near the cusps.
            round_x, round_y = superellipse(angle, 2.05 if kind == "molar" else 2.15)
            blend = outline_blend[profile_index]
            x_unit = round_x * (1.0 - blend) + outline_x * blend
            y_unit = round_y * (1.0 - blend) + outline_y * blend
            x = width * 0.5 * x_scale * x_unit
            y = depth * 0.5 * y_scale * y_unit
            if y_unit < -0.12:
                # Developmental grooves divide the convex buccal surface into
                # genuine lobes. M1 mandibular has two grooves for three lobes.
                groove_centres = (-0.28, 0.30) if (not upper and tooth_index == 6) else (0.0,)
                groove = sum(math.exp(-((x_unit - centre) / 0.105) ** 2) for centre in groove_centres)
                y *= 1.0 - 0.16 * groove * math.exp(-((q - 0.02) / 0.25) ** 2)
            z_relief = 0.0
            if profile_index == len(side_profiles) - 1:
                z_relief = 0.24 * cusp_relief(x_unit, y_unit, spread=0.56)
            elif profile_index == len(side_profiles) - 2:
                z_relief = 0.10 * cusp_relief(x_unit, y_unit, spread=0.52)
            vertices.append((x, y, height * (q + z_relief) * chewing_sign))
    for ring in range(len(side_profiles) - 1):
        current = ring * ring_vertices
        following_ring = (ring + 1) * ring_vertices
        for segment in range(ring_vertices):
            following = (segment + 1) % ring_vertices
            faces.append((current + segment, current + following, following_ring + following, following_ring + segment))
    faces.append(tuple(range(ring_vertices - 1, -1, -1)) if chewing_sign > 0 else tuple(range(ring_vertices)))

    def occlusal_height(x_norm, y_norm, radius):
        fade = max(0.0, 1.0 - radius ** 2) ** 0.58
        relief = cusp_relief(x_norm, y_norm)
        central_fossa = 0.095 * math.exp(-((x_norm / 0.24) ** 2 + (y_norm / 0.22) ** 2))
        mesiodistal_groove = 0.050 * math.exp(-(y_norm / 0.075) ** 2) * max(0.0, 1.0 - x_norm ** 6)
        buccolingual_groove = 0.040 * math.exp(-(x_norm / 0.078) ** 2) * max(0.0, 1.0 - y_norm ** 6)
        triangular_ridges = 0.020 * math.cos(math.atan2(y_norm, x_norm) * len(cusps)) * max(0.0, 1.0 - radius) ** 1.5
        edge_relief = 0.24 * cusp_relief(x_norm, y_norm, spread=0.56)
        return 0.16 + edge_relief + fade * (0.58 * relief + triangular_ridges - central_fossa - mesiodistal_groove - buccolingual_groove)

    center_index = len(vertices)
    vertices.append((0.0, 0.0, height * occlusal_height(0.0, 0.0, 0.0) * chewing_sign))
    cap_rings = []
    for radial_index in range(1, radial_rings + 1):
        radius = radial_index / radial_rings
        ring = []
        for segment in range(ring_vertices):
            angle = 2 * math.pi * segment / ring_vertices
            x_unit, y_unit = posterior_outline(angle, kind, upper, tooth_index, side)
            x_norm, y_norm = x_unit * radius, y_unit * radius
            ring.append(len(vertices))
            vertices.append((width * 0.5 * x_norm, depth * 0.5 * y_norm, height * occlusal_height(x_norm, y_norm, radius) * chewing_sign))
        cap_rings.append(ring)

    for segment in range(ring_vertices):
        following = (segment + 1) % ring_vertices
        face = (center_index, cap_rings[0][segment], cap_rings[0][following])
        faces.append(face if chewing_sign > 0 else tuple(reversed(face)))
    for radial_index in range(len(cap_rings) - 1):
        inner, outer = cap_rings[radial_index], cap_rings[radial_index + 1]
        for segment in range(ring_vertices):
            following = (segment + 1) % ring_vertices
            face = (inner[segment], outer[segment], outer[following], inner[following])
            faces.append(face if chewing_sign > 0 else tuple(reversed(face)))
    side_top = (len(side_profiles) - 1) * ring_vertices
    outer = cap_rings[-1]
    for segment in range(ring_vertices):
        following = (segment + 1) % ring_vertices
        face = (side_top + segment, outer[segment], outer[following], side_top + following)
        faces.append(face if chewing_sign > 0 else tuple(reversed(face)))

    mesh = bpy.data.meshes.new(f"{name}_Crown")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    return mesh


def add_gingival_arch(name, upper, material):
    """Build a broad, flattened gingival saddle around the cervical crowns.

    This is intentionally a band rather than the old circular tube: the crown
    margin is thin and scalloped while the root side gains the larger volume
    visible in a natural open-mouth model.
    """
    tooth_order = list(range(8, 0, -1)) + list(range(1, 9))
    side_order = [-1] * 8 + [1] * 8
    centres = []
    for side, index in zip(side_order, tooth_order):
        x, y, _ = arch_point(side, index, upper)
        centres.append(Vector((x, y, 0.0)))

    # Catmull-Rom interpolation follows the dental arch without the polygonal
    # corners produced by simply joining tooth centres.
    path = []
    margin_scallops = []
    samples_per_tooth = 5
    for point_index in range(len(centres) - 1):
        p0 = centres[max(0, point_index - 1)]
        p1 = centres[point_index]
        p2 = centres[point_index + 1]
        p3 = centres[min(len(centres) - 1, point_index + 2)]
        for sample in range(samples_per_tooth):
            t = sample / samples_per_tooth
            t2, t3 = t * t, t * t * t
            point = 0.5 * ((2.0 * p1) + (-p0 + p2) * t
                           + (2.0 * p0 - 5.0 * p1 + 4.0 * p2 - p3) * t2
                           + (-p0 + 3.0 * p1 - 3.0 * p2 + p3) * t3)
            path.append(point)
            margin_scallops.append(math.cos(2.0 * math.pi * t))
    path.append(centres[-1])
    margin_scallops.append(1.0)

    margin_z = 1.02 if upper else -1.02
    root_z = 1.67 if upper else -1.67
    direction = 1.0 if upper else -1.0
    # Flat facial wall plus a short palatal/lingual return.  This avoids the
    # "pink tube" look while preserving the substantial gum volume requested.
    cross_section = [
        (-0.56, margin_z),
        (0.40, margin_z),
        (0.47, root_z - direction * 0.04),
        (0.18, root_z + direction * 0.035),
        (-0.57, root_z + direction * 0.015),
    ]
    vertices = []
    faces = []
    section_size = len(cross_section)
    for point_index, point in enumerate(path):
        previous = path[max(0, point_index - 1)]
        following = path[min(len(path) - 1, point_index + 1)]
        tangent = (following - previous).normalized()
        normal = Vector((-tangent.y, tangent.x, 0.0)).normalized()
        # Subtle papilla scalloping keeps the margin from looking machine-cut.
        scallop = direction * 0.055 * margin_scallops[point_index]
        posterior_scale = 1.0 + 0.08 * max(0.0, point.y / 1.55)
        for offset, z_value in cross_section:
            vertex = point + normal * offset * posterior_scale
            vertices.append((vertex.x, vertex.y, z_value + (scallop if abs(z_value - margin_z) < 0.22 else 0.0)))

    for path_index in range(len(path) - 1):
        current = path_index * section_size
        following = (path_index + 1) * section_size
        for section_index in range(section_size):
            next_section = (section_index + 1) % section_size
            faces.append((current + section_index, current + next_section,
                          following + next_section, following + section_index))
    faces.append(tuple(range(section_size - 1, -1, -1)))
    last = (len(path) - 1) * section_size
    faces.append(tuple(last + index for index in range(section_size)))

    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    gum = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(gum)
    gum.data.materials.append(material)
    gum["interactive"] = False
    gum["anatomical_part"] = "gingiva"
    finish_surface(gum, bevel=0.025, subdivision=1)
    return gum


def tooth_dimensions(upper, index):
    upper_sizes = {
        1: (0.82, 0.58, 1.06), 2: (0.65, 0.53, 0.95), 3: (0.72, 0.72, 1.10),
        4: (0.74, 0.89, 0.80), 5: (0.77, 0.92, 0.77), 6: (1.08, 1.14, 0.80),
        7: (1.02, 1.08, 0.77), 8: (0.91, 0.98, 0.72),
    }
    lower_sizes = {
        1: (0.52, 0.46, 0.87), 2: (0.57, 0.49, 0.91), 3: (0.64, 0.64, 1.00),
        4: (0.69, 0.78, 0.74), 5: (0.76, 0.85, 0.74), 6: (1.06, 1.04, 0.78),
        7: (0.99, 0.99, 0.75), 8: (0.91, 0.93, 0.70),
    }
    return (upper_sizes if upper else lower_sizes)[index]


def arch_point(side, index, upper):
    # Upper and lower arches differ subtly in width and anterior spacing.
    upper_table = [(0.41, -2.68, 0.03), (1.01, -2.54, 0.18), (1.55, -2.17, 0.40), (2.00, -1.61, 0.63), (2.35, -0.92, 0.84), (2.57, -0.12, 1.03), (2.63, 0.73, 1.19), (2.55, 1.55, 1.34)]
    lower_table = [(0.29, -2.54, 0.02), (0.76, -2.46, 0.15), (1.26, -2.18, 0.35), (1.72, -1.68, 0.59), (2.08, -1.02, 0.80), (2.34, -0.24, 1.00), (2.43, 0.59, 1.17), (2.38, 1.39, 1.32)]
    x, y, angle = (upper_table if upper else lower_table)[index - 1]
    return side * x, y, -side * angle


def add_tooth(code, side, upper, index, kind, enamel):
    width, depth, height = tooth_dimensions(upper, index)
    x, y, angle = arch_point(side, index, upper)
    if kind in ("central", "lateral", "canine"):
        z = 0.78 if upper else -0.78
        mesh = anterior_crown_mesh(code, width, depth, height, kind, upper, side)
    else:
        z = 0.62 if upper else -0.62
        mesh = posterior_crown_mesh(code, width, depth, height, kind, upper, index, side)
    tooth = bpy.data.objects.new(f"Tooth_{code}", mesh)
    bpy.context.collection.objects.link(tooth)
    tooth.location = (x, y, z)
    tooth.rotation_euler.z = angle
    tooth.data.materials.append(enamel)
    finish_surface(tooth, bevel=0.016, subdivision=1)
    tooth["fdi"] = code
    tooth["interactive"] = True
    tooth["tooth_kind"] = kind
    tooth["upper"] = upper
    return tooth


def look_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene
scene.name = "BookEasy Original Adult Dentition"
scene["copyright"] = "Original procedural geometry created for BookEasy"
scene["third_party_geometry"] = False
bpy.context.preferences.filepaths.save_version = 0
available_engines = [item.identifier for item in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items]
scene.render.engine = next((engine for engine in available_engines if "EEVEE" in engine), scene.render.engine)
scene.render.resolution_x = 1200
scene.render.resolution_y = 900
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.filepath = PREVIEW_PATH
scene.world.color = (0.025, 0.035, 0.04)

enamel = make_material("Natural enamel", (0.93, 0.91, 0.83, 1.0), 0.20)
gingiva = make_material("Healthy gingiva", (0.62, 0.13, 0.16, 1.0), 0.31)

kinds = {1: "central", 2: "lateral", 3: "canine", 4: "premolar", 5: "premolar", 6: "molar", 7: "molar", 8: "molar"}
for quadrant, side, upper in ((1, -1, True), (2, 1, True), (3, 1, False), (4, -1, False)):
    for index in range(1, 9):
        add_tooth(f"{quadrant}{index}", side, upper, index, kinds[index], enamel)

add_gingival_arch("Gingiva_Upper", True, gingiva)
add_gingival_arch("Gingiva_Lower", False, gingiva)

# Clinical studio preview retained in the editable .blend file.
bpy.ops.object.camera_add(location=(7.4, -12.8, 3.8))
camera = bpy.context.object
camera.name = "BookEasy_Clinical_Camera"
camera.data.lens = 60
look_at(camera, (0, -0.32, 0.0))
scene.camera = camera
for name, location, energy, size in (
    ("Key", (-5.5, -6.5, 8.0), 1100, 5.0),
    ("Fill", (6.5, -2.0, 4.5), 760, 4.0),
    ("Rim", (0.0, 5.5, 7.0), 900, 3.2),
):
    bpy.ops.object.light_add(type="AREA", location=location)
    light = bpy.context.object
    light.name = f"BookEasy_{name}"
    light.data.energy = energy
    light.data.shape = "DISK"
    light.data.size = size
    look_at(light, (0, 0, 0))

os.makedirs(os.path.dirname(BLEND_PATH), exist_ok=True)
os.makedirs(os.path.dirname(GLB_PATH), exist_ok=True)
os.makedirs(os.path.dirname(PREVIEW_PATH), exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)

for obj in scene.objects:
    obj.select_set(obj.type == "MESH")
bpy.context.view_layer.objects.active = bpy.data.objects.get("Tooth_11")
bpy.ops.export_scene.gltf(
    filepath=GLB_PATH,
    export_format="GLB",
    use_selection=True,
    export_apply=True,
    export_extras=True,
    export_materials="EXPORT",
)
bpy.ops.render.render(write_still=True)

# Produce a second QA render of one maxillary quadrant, ordered from third
# molar to central incisor, so every visible crown remains easy to audit.
# This happens after the editable source is saved and does not alter the .blend.
for obj in scene.objects:
    if obj.type == "MESH":
        obj.hide_render = True
representatives = ["18", "17", "16", "15", "14", "13", "12", "11"]
for position, code in enumerate(representatives):
    tooth = bpy.data.objects.get(f"Tooth_{code}")
    tooth.hide_render = False
    tooth.location = (-4.10 + position * 1.17, 0.0, -0.76)
    tooth.rotation_euler = (0.0, 0.0, 0.0)
    for child in tooth.children:
        child.hide_render = True
camera.location = (0.0, -15.5, 1.1)
camera.data.lens = 58
look_at(camera, (0.0, 0.0, 0.15))
scene.render.resolution_x = 1600
scene.render.resolution_y = 720
scene.render.filepath = TYPES_PREVIEW_PATH
bpy.ops.render.render(write_still=True)
print(f"Created original Blender source: {BLEND_PATH}")
print(f"Exported realistic exterior model: {GLB_PATH}")
print(f"Rendered preview: {PREVIEW_PATH}")
print(f"Rendered tooth type preview: {TYPES_PREVIEW_PATH}")

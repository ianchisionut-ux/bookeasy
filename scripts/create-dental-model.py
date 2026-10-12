import bpy
import math
import os
from mathutils import Vector


ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
BLEND_PATH = os.path.join(ROOT, "assets", "blender", "bookeasy-dental-chart.blend")
GLB_PATH = os.path.join(ROOT, "public", "models", "bookeasy-dental-chart.glb")
PREVIEW_PATH = os.path.join(ROOT, "output", "dental-model-preview.png")


def material(name, color, roughness=0.45, metallic=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = next(node for node in mat.node_tree.nodes if node.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    return mat


def smooth_bevel(obj, bevel=0.035, segments=2):
    if obj.type == "MESH":
        for polygon in obj.data.polygons:
            polygon.use_smooth = True
    if bevel > 0:
        modifier = obj.modifiers.new("Anatomical edge softening", "BEVEL")
        modifier.width = bevel
        modifier.segments = segments


def superellipse(angle, exponent):
    power = 2.0 / exponent
    cosine = math.cos(angle)
    sine = math.sin(angle)
    return math.copysign(abs(cosine) ** power, cosine), math.copysign(abs(sine) ** power, sine)


def loft_mesh(name, width, depth, height, profiles, exponent=3.2, rings=32):
    vertices = []
    faces = []
    for q, x_scale, y_scale in profiles:
        for index in range(rings):
            angle = 2 * math.pi * index / rings
            x_unit, y_unit = superellipse(angle, exponent)
            lingual_taper = 0.94 if y_unit > 0 else 1.0
            vertices.append((width * 0.5 * x_scale * x_unit, depth * 0.5 * y_scale * y_unit * lingual_taper, height * q))
    for ring in range(len(profiles) - 1):
        start = ring * rings
        next_start = (ring + 1) * rings
        for index in range(rings):
            following = (index + 1) % rings
            faces.append((start + index, start + following, next_start + following, next_start + index))
    faces.append(tuple(range(rings - 1, -1, -1)))
    last = (len(profiles) - 1) * rings
    faces.append(tuple(last + index for index in range(rings)))
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    return mesh


def anterior_crown_mesh(name, width, depth, height, kind, upper):
    chew = -1 if upper else 1
    if kind == "canine":
        canonical = [(-0.50, 0.60, 0.70), (-0.34, 0.82, 0.88), (-0.05, 1.00, 1.00), (0.24, 0.82, 0.86), (0.42, 0.42, 0.50), (0.52, 0.06, 0.10)]
        exponent = 2.6
    else:
        canonical = [(-0.50, 0.62, 0.72), (-0.35, 0.82, 0.88), (-0.06, 1.00, 1.00), (0.27, 0.99, 0.91), (0.47, 0.93, 0.73), (0.51, 0.88, 0.68)]
        exponent = 4.4
    profiles = [(q * chew, x, y) for q, x, y in canonical]
    if chew < 0:
        profiles.reverse()
    return loft_mesh(name, width, depth, height, profiles, exponent=exponent)


def posterior_anatomy(kind, upper, index):
    if kind == "premolar":
        if not upper and index == 5:
            return [(-0.02, -0.34, 0.24), (-0.27, 0.30, 0.16), (0.27, 0.30, 0.15)]
        return [(0.0, -0.34, 0.24), (0.0, 0.32, 0.19 if upper else 0.12)]
    if upper:
        if index == 8:
            return [(-0.29, -0.27, 0.18), (0.29, -0.24, 0.15), (-0.10, 0.27, 0.17)]
        return [(-0.34, -0.31, 0.20), (0.33, -0.29, 0.17), (-0.31, 0.30, 0.23), (0.28, 0.28, 0.14)]
    if index == 6:
        return [(-0.42, -0.29, 0.18), (0.0, -0.35, 0.19), (0.40, -0.24, 0.15), (-0.30, 0.30, 0.18), (0.30, 0.30, 0.17)]
    if index == 8:
        return [(-0.34, -0.28, 0.16), (0.31, -0.27, 0.15), (-0.28, 0.28, 0.16), (0.29, 0.27, 0.15), (0.0, 0.04, 0.09)]
    return [(-0.34, -0.30, 0.18), (0.34, -0.29, 0.17), (-0.31, 0.30, 0.18), (0.31, 0.29, 0.17)]


def posterior_crown_mesh(name, width, depth, height, kind, upper, index, detail=1.0):
    chew = -1 if upper else 1
    ring_vertices = 40
    radial_rings = 7
    exponent = 3.4 if kind == "molar" else 2.7
    side_profiles = [(-0.50, 0.66, 0.70), (-0.30, 0.84, 0.88), (-0.04, 0.99, 1.00), (0.20, 1.0, 0.97)]
    vertices = []
    faces = []
    for q, x_scale, y_scale in side_profiles:
        for segment in range(ring_vertices):
            angle = 2 * math.pi * segment / ring_vertices
            x_unit, y_unit = superellipse(angle, exponent)
            vertices.append((width * 0.5 * x_scale * x_unit, depth * 0.5 * y_scale * y_unit, height * q * chew))
    for ring in range(len(side_profiles) - 1):
        start = ring * ring_vertices
        next_start = (ring + 1) * ring_vertices
        for segment in range(ring_vertices):
            following = (segment + 1) % ring_vertices
            faces.append((start + segment, start + following, next_start + following, next_start + segment))
    faces.append(tuple(range(ring_vertices - 1, -1, -1)) if chew > 0 else tuple(range(ring_vertices)))
    cusps = posterior_anatomy(kind, upper, index)

    def occlusal_q(x_norm, y_norm, radius):
        fade = max(0.0, 1.0 - radius ** 2) ** 0.62
        relief = sum(amplitude * math.exp(-((((x_norm - cusp_x) / 0.28) ** 2 + ((y_norm - cusp_y) / 0.27) ** 2) * 1.7)) for cusp_x, cusp_y, amplitude in cusps)
        fossa = 0.055 * math.exp(-((x_norm / 0.24) ** 2 + (y_norm / 0.22) ** 2))
        groove = 0.028 * math.exp(-(y_norm / 0.075) ** 2) * max(0.0, 1.0 - x_norm ** 4)
        groove += 0.020 * math.exp(-(x_norm / 0.075) ** 2) * max(0.0, 1.0 - y_norm ** 4)
        return 0.20 + detail * fade * (relief - fossa - groove)

    center_index = len(vertices)
    vertices.append((0.0, 0.0, height * occlusal_q(0.0, 0.0, 0.0) * chew))
    cap_rings = []
    for radial in range(1, radial_rings + 1):
        radius = radial / radial_rings
        ring_indices = []
        for segment in range(ring_vertices):
            angle = 2 * math.pi * segment / ring_vertices
            x_unit, y_unit = superellipse(angle, exponent)
            x_norm, y_norm = x_unit * radius, y_unit * radius
            ring_indices.append(len(vertices))
            vertices.append((width * 0.5 * x_norm, depth * 0.5 * y_norm, height * occlusal_q(x_norm, y_norm, radius) * chew))
        cap_rings.append(ring_indices)
    first = cap_rings[0]
    for segment in range(ring_vertices):
        following = (segment + 1) % ring_vertices
        face = (center_index, first[segment], first[following])
        faces.append(face if chew > 0 else tuple(reversed(face)))
    for radial in range(len(cap_rings) - 1):
        inner, outer = cap_rings[radial], cap_rings[radial + 1]
        for segment in range(ring_vertices):
            following = (segment + 1) % ring_vertices
            face = (inner[segment], outer[segment], outer[following], inner[following])
            faces.append(face if chew > 0 else tuple(reversed(face)))
    side_top, outer = (len(side_profiles) - 1) * ring_vertices, cap_rings[-1]
    for segment in range(ring_vertices):
        following = (segment + 1) % ring_vertices
        face = (side_top + segment, outer[segment], outer[following], side_top + following)
        faces.append(face if chew > 0 else tuple(reversed(face)))
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    return mesh


def parent_keep_transform(child, parent):
    world_matrix = child.matrix_world.copy()
    child.parent = parent
    child.matrix_world = world_matrix


def tube_mesh(name, centerline, radii, radial_segments=14):
    vertices = []
    faces = []
    for point_index, center in enumerate(centerline):
        for radial in range(radial_segments):
            angle = 2 * math.pi * radial / radial_segments
            vertices.append((center.x + radii[point_index] * math.cos(angle), center.y + radii[point_index] * math.sin(angle), center.z))
    for point_index in range(len(centerline) - 1):
        current, following_ring = point_index * radial_segments, (point_index + 1) * radial_segments
        for radial in range(radial_segments):
            following = (radial + 1) % radial_segments
            faces.append((current + radial, current + following, following_ring + following, following_ring + radial))
    faces.append(tuple(range(radial_segments - 1, -1, -1)))
    last = (len(centerline) - 1) * radial_segments
    faces.append(tuple(last + radial for radial in range(radial_segments)))
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    return mesh


def root_plan(kind, upper, index):
    if kind == "molar":
        if upper:
            return [(-0.24, -0.18, 1.15, -0.08), (0.24, -0.18, 1.12, 0.08), (0.0, 0.27, 1.28, 0.02)]
        return [(-0.24, 0.0, 1.15, -0.10), (0.24, 0.0, 1.12, 0.10)]
    if kind == "premolar" and upper and index == 4:
        return [(0.0, -0.15, 1.08, -0.04), (0.0, 0.15, 1.03, 0.04)]
    length = 1.34 if kind == "canine" else 1.03 if kind == "premolar" else 1.10
    return [(0.0, 0.0, length, 0.07 if index % 2 == 0 else -0.05)]


def add_root_components(tooth, code, location, kind, upper, index, height, materials):
    root_direction = 1 if upper else -1
    rotation = tooth.rotation_euler.to_matrix()
    for root_index, (offset_x, offset_y, length, curve_x) in enumerate(root_plan(kind, upper, index), start=1):
        root_radius = 0.17 if kind in ("molar", "canine") else 0.145
        samples = 9
        centerline = []
        for step in range(samples):
            t = step / (samples - 1)
            local = Vector((offset_x * (0.72 + 0.28 * t) + curve_x * t * t, offset_y * (0.72 + 0.28 * t), root_direction * (height * 0.39 + length * t)))
            centerline.append(Vector(location) + rotation @ local)
        radii = [root_radius * (0.98 - 0.82 * (step / (samples - 1)) ** 1.25) for step in range(samples)]
        for prefix, scale, mat, segments in [
            ("Ligament", 1.10, materials["ligament"], 16),
            ("Root", 1.0, materials["cementum"], 18),
            ("Canal", 0.25, materials["pulp"], 12),
        ]:
            component_radii = [max(0.018, radius * scale) for radius in radii]
            component = bpy.data.objects.new(f"{prefix}_{code}_{root_index}", tube_mesh(f"{prefix}_{code}_{root_index}", centerline, component_radii, segments))
            bpy.context.collection.objects.link(component)
            component.data.materials.append(mat)
            parent_keep_transform(component, tooth)
        for prefix, lateral, mat in [("Nerve", 0.0, materials["nerve"]), ("Artery", -0.016, materials["artery"]), ("Vein", 0.016, materials["vein"])]:
            line = [point + rotation @ Vector((lateral, 0.0, 0.0)) for point in centerline]
            bundle_radii = [0.013 * (1.0 - 0.35 * i / (samples - 1)) for i in range(samples)]
            component = bpy.data.objects.new(f"{prefix}_{code}_{root_index}", tube_mesh(f"{prefix}_{code}_{root_index}", line, bundle_radii, 8))
            bpy.context.collection.objects.link(component)
            component.data.materials.append(mat)
            parent_keep_transform(component, tooth)


def add_tooth(code, location, rotation_z, kind, upper, index, materials):
    scale = 0.94 if not upper else 1.0
    dimensions = {"central": (0.76, 0.54, 1.02), "lateral": (0.62, 0.50, 0.91), "canine": (0.68, 0.68, 1.05), "premolar": (0.72, 0.86, 0.76), "molar": (0.96, 1.06, 0.72)}[kind]
    width, depth, height = [value * scale for value in dimensions]
    if index == 7:
        width, depth = width * 0.94, depth * 0.95
    elif index == 8:
        width, depth = width * 0.86, depth * 0.88
    crown = anterior_crown_mesh(code, width, depth, height, kind, upper) if kind in ("central", "lateral", "canine") else posterior_crown_mesh(code, width, depth, height, kind, upper, index)
    tooth = bpy.data.objects.new(f"Tooth_{code}", crown)
    bpy.context.collection.objects.link(tooth)
    tooth.location = location
    tooth.rotation_euler.z = rotation_z
    tooth.data.materials.append(materials["enamel"])
    smooth_bevel(tooth, 0.025, 2)
    dentin_mesh = anterior_crown_mesh(f"Dentin_{code}", width * 0.79, depth * 0.77, height * 0.82, kind, upper) if kind in ("central", "lateral", "canine") else posterior_crown_mesh(f"Dentin_{code}", width * 0.78, depth * 0.76, height * 0.80, kind, upper, index, detail=0.72)
    dentin = bpy.data.objects.new(f"Dentin_{code}", dentin_mesh)
    bpy.context.collection.objects.link(dentin)
    dentin.location, dentin.rotation_euler.z = location, rotation_z
    dentin.data.materials.append(materials["dentin"])
    parent_keep_transform(dentin, tooth)
    pulp_width = width * (0.22 if kind in ("central", "lateral", "canine") else 0.34)
    pulp_depth = depth * (0.24 if kind in ("central", "lateral", "canine") else 0.34)
    pulp_mesh = anterior_crown_mesh(f"Pulp_{code}", pulp_width, pulp_depth, height * 0.53, "canine" if kind == "canine" else "central", upper)
    pulp = bpy.data.objects.new(f"Pulp_{code}", pulp_mesh)
    bpy.context.collection.objects.link(pulp)
    pulp.location, pulp.rotation_euler.z = location, rotation_z
    pulp.data.materials.append(materials["pulp"])
    parent_keep_transform(pulp, tooth)
    if kind in ("premolar", "molar"):
        chew = -1 if upper else 1
        rotation = tooth.rotation_euler.to_matrix()
        for horn_index, (cusp_x, cusp_y, amplitude) in enumerate(posterior_anatomy(kind, upper, index), start=1):
            horn_location = Vector(location) + rotation @ Vector((cusp_x * width * 0.32, cusp_y * depth * 0.32, chew * height * 0.19))
            bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1.0, location=horn_location)
            horn = bpy.context.object
            horn.name = f"PulpHorn_{code}_{horn_index}"
            horn.scale = (width * 0.075, depth * 0.075, height * (0.10 + amplitude * 0.10))
            bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
            horn.data.materials.append(materials["pulp"])
            parent_keep_transform(horn, tooth)
    add_root_components(tooth, code, location, kind, upper, index, height, materials)
    tooth["fdi"], tooth["interactive"], tooth["tooth_kind"], tooth["upper"] = code, True, kind, upper
    return tooth


def arch_point(side, index):
    table = [(0.38, -2.68, 0.03), (0.96, -2.55, 0.18), (1.49, -2.18, 0.39), (1.94, -1.62, 0.62), (2.29, -0.93, 0.84), (2.52, -0.13, 1.02), (2.58, 0.72, 1.18), (2.50, 1.53, 1.34)]
    x, y, angle = table[index - 1]
    return side * x, y, -side * angle


def add_gum_arch(name, z_center, gum):
    segments, ring_segments = 64, 14
    half_width, z_radius = 0.69, 0.63
    vertices, faces, centers = [], [], []
    for i in range(segments + 1):
        t = -math.pi / 2 + math.pi * (i / segments)
        centers.append(Vector((2.94 * math.sin(t), -2.73 + 4.55 * (abs(t) / (math.pi / 2)) ** 1.55, z_center)))
    for i, center in enumerate(centers):
        tangent = (centers[min(segments, i + 1)] - centers[max(0, i - 1)]).normalized()
        normal = Vector((-tangent.y, tangent.x, 0)).normalized()
        for ring_index in range(ring_segments):
            phi = 2 * math.pi * ring_index / ring_segments
            vertices.append(tuple(center + normal * (half_width * math.cos(phi)) + Vector((0, 0, z_radius * math.sin(phi)))))
    for i in range(segments):
        current, following = i * ring_segments, (i + 1) * ring_segments
        for ring_index in range(ring_segments):
            next_ring = (ring_index + 1) % ring_segments
            faces.append((current + ring_index, following + ring_index, following + next_ring, current + next_ring))
    faces.extend([tuple(range(ring_segments - 1, -1, -1)), tuple(segments * ring_segments + ring_index for ring_index in range(ring_segments))])
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    smooth_bevel(obj, 0.065, 3)
    obj.data.materials.append(gum)
    obj["interactive"] = False
    return obj


def look_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene
scene.name = "BookEasy Original Human Dental Chart"
bpy.context.preferences.filepaths.save_version = 0
render_engines = [item.identifier for item in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items]
scene.render.engine = next((engine for engine in render_engines if "EEVEE" in engine), scene.render.engine)
scene.render.resolution_x, scene.render.resolution_y, scene.render.resolution_percentage = 1200, 900, 100
scene.render.image_settings.file_format = "PNG"
scene.render.filepath = PREVIEW_PATH
scene.world.color = (0.025, 0.035, 0.04)

materials = {
    "enamel": material("Enamel", (0.96, 0.94, 0.86, 1), 0.21),
    "dentin": material("Dentin", (0.90, 0.66, 0.27, 1), 0.42),
    "cementum": material("Cementum", (0.78, 0.67, 0.47, 1), 0.48),
    "pulp": material("Pulp chamber", (0.66, 0.025, 0.035, 1), 0.34),
    "nerve": material("Dental nerve", (0.98, 0.72, 0.08, 1), 0.31),
    "artery": material("Pulp artery", (0.86, 0.015, 0.02, 1), 0.30),
    "vein": material("Pulp vein", (0.03, 0.24, 0.74, 1), 0.30),
    "ligament": material("Periodontal ligament", (0.91, 0.43, 0.46, 1), 0.44),
}
gum = material("Healthy gingiva", (0.72, 0.22, 0.25, 1), 0.38)
add_gum_arch("Gingiva_Upper", 2.12, gum)
add_gum_arch("Gingiva_Lower", -2.12, gum)
kinds = {1: "central", 2: "lateral", 3: "canine", 4: "premolar", 5: "premolar", 6: "molar", 7: "molar", 8: "molar"}
for quadrant, side, upper in [(1, -1, True), (2, 1, True), (3, 1, False), (4, -1, False)]:
    for index in range(1, 9):
        x, y, angle = arch_point(side, index)
        add_tooth(f"{quadrant}{index}", (x, y, 1.32 if upper else -1.32), angle, kinds[index], upper, index, materials)

bpy.ops.object.camera_add(location=(8.2, -11.8, 6.5))
camera = bpy.context.object
camera.name, camera.data.lens = "BookEasy_Clinical_Camera", 58
look_at(camera, (0, -0.30, 0))
scene.camera = camera
for name, location, energy, size in [("Key", (-5.5, -6.0, 8.0), 1120, 5.0), ("Fill", (6.0, -2.5, 4.0), 780, 4.0), ("Rim", (0.0, 5.0, 7.0), 920, 3.0)]:
    bpy.ops.object.light_add(type="AREA", location=location)
    light = bpy.context.object
    light.name, light.data.energy, light.data.shape, light.data.size = f"BookEasy_{name}", energy, "DISK", size
    look_at(light, (0, 0, 0))

os.makedirs(os.path.dirname(BLEND_PATH), exist_ok=True)
os.makedirs(os.path.dirname(GLB_PATH), exist_ok=True)
os.makedirs(os.path.dirname(PREVIEW_PATH), exist_ok=True)
internal_prefixes = ("Dentin_", "Pulp_", "PulpHorn_", "Root_", "Canal_", "Ligament_", "Nerve_", "Artery_", "Vein_")
for obj in scene.objects:
    if obj.name.startswith(internal_prefixes):
        obj.hide_render = True
bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)
for obj in scene.objects:
    obj.hide_render = False
    obj.hide_viewport = False
    obj.select_set(obj.type == "MESH")
bpy.context.view_layer.objects.active = bpy.data.objects.get("Gingiva_Upper")
bpy.ops.export_scene.gltf(filepath=GLB_PATH, export_format="GLB", use_selection=True, export_apply=True, export_extras=True, export_materials="EXPORT")
for obj in scene.objects:
    if obj.name.startswith(internal_prefixes):
        obj.hide_render = True
bpy.ops.render.render(write_still=True)
print(f"Created original Blender source: {BLEND_PATH}")
print(f"Exported interactive model: {GLB_PATH}")
print(f"Rendered preview: {PREVIEW_PATH}")

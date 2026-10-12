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


def smooth_bevel(obj, bevel=0.10, segments=2):
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    modifier = obj.modifiers.new("Clinical edge softening", "BEVEL")
    modifier.width = bevel
    modifier.segments = segments


def add_tooth(name, location, rotation_z, kind, upper, ivory):
    dimensions = {
        "central": (0.62, 0.52, 0.88),
        "lateral": (0.54, 0.48, 0.78),
        "canine": (0.58, 0.62, 0.92),
        "premolar": (0.62, 0.78, 0.72),
        "molar": (0.82, 0.96, 0.66),
    }[kind]
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=1.0, location=location)
    tooth = bpy.context.object
    tooth.name = f"Tooth_{name}"
    tooth.scale = (dimensions[0], dimensions[1], dimensions[2])
    tooth.rotation_euler.z = rotation_z
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

    # Crown anatomy: flatter proximal faces and a subtle chewing/incisal plane.
    for vertex in tooth.data.vertices:
        local_z = vertex.co.z / max(dimensions[2], 0.01)
        if (upper and local_z < -0.58) or ((not upper) and local_z > 0.58):
            vertex.co.z *= 0.92
        if kind == "canine":
            tip_side = -1 if upper else 1
            if local_z * tip_side > 0.35:
                vertex.co.x *= 0.82
        if kind in ("premolar", "molar"):
            chewing_side = -1 if upper else 1
            if local_z * chewing_side > 0.48:
                vertex.co.z *= 0.94

    smooth_bevel(tooth, 0.055, 2)
    tooth.data.materials.append(ivory)
    tooth["fdi"] = name
    tooth["interactive"] = True
    tooth["tooth_kind"] = kind
    return tooth


def arch_point(side, index):
    # index 1..8, central incisor to wisdom tooth; side -1/right, +1/left.
    table = [
        (0.34, -2.72, 0.03),
        (0.90, -2.58, 0.18),
        (1.43, -2.22, 0.39),
        (1.90, -1.66, 0.62),
        (2.25, -0.96, 0.83),
        (2.48, -0.15, 1.02),
        (2.55, 0.72, 1.18),
        (2.48, 1.57, 1.34),
    ]
    x, y, angle = table[index - 1]
    return side * x, y, -side * angle


def add_gum_arch(name, z_center, upper, gum):
    segments = 56
    ring_segments = 10
    half_width = 0.72
    z_radius = 0.56
    verts = []
    faces = []

    centers = []
    for i in range(segments + 1):
        t = -math.pi / 2 + math.pi * (i / segments)
        x = 2.92 * math.sin(t)
        y = -2.72 + 4.58 * (abs(t) / (math.pi / 2)) ** 1.55
        centers.append(Vector((x, y, z_center)))

    for i, center in enumerate(centers):
        prev = centers[max(0, i - 1)]
        nxt = centers[min(segments, i + 1)]
        tangent = (nxt - prev).normalized()
        normal = Vector((-tangent.y, tangent.x, 0)).normalized()
        for ring_index in range(ring_segments):
            phi = 2 * math.pi * ring_index / ring_segments
            lateral = half_width * math.cos(phi)
            vertical = z_radius * math.sin(phi)
            verts.append(tuple(center + normal * lateral + Vector((0, 0, vertical))))

    for i in range(segments):
        a = i * ring_segments
        b = (i + 1) * ring_segments
        for ring_index in range(ring_segments):
            next_ring = (ring_index + 1) % ring_segments
            faces.append((a + ring_index, b + ring_index, b + next_ring, a + next_ring))
    faces.extend([
        tuple(range(ring_segments - 1, -1, -1)),
        tuple(segments * ring_segments + ring_index for ring_index in range(ring_segments)),
    ])

    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    smooth_bevel(obj, 0.08, 2)
    obj.data.materials.append(gum)
    obj["interactive"] = False
    return obj


def look_at(obj, target):
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


# New clean Blender document dedicated to BookEasy.
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
for datablocks in (bpy.data.meshes, bpy.data.curves, bpy.data.materials, bpy.data.cameras, bpy.data.lights):
    pass

scene = bpy.context.scene
scene.name = "BookEasy Dental Chart"
render_engines = [item.identifier for item in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items]
scene.render.engine = next((engine for engine in render_engines if "EEVEE" in engine), scene.render.engine)
scene.render.resolution_x = 1200
scene.render.resolution_y = 900
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.filepath = PREVIEW_PATH
scene.render.film_transparent = False
scene.world.color = (0.035, 0.05, 0.06)

ivory = material("Tooth enamel", (0.93, 0.90, 0.80, 1), roughness=0.24)
gum = material("Healthy gingiva", (0.64, 0.13, 0.15, 1), roughness=0.42)

add_gum_arch("Gingiva_Upper", 1.92, True, gum)
add_gum_arch("Gingiva_Lower", -1.92, False, gum)

kinds = {1: "central", 2: "lateral", 3: "canine", 4: "premolar", 5: "premolar", 6: "molar", 7: "molar", 8: "molar"}
for quadrant, side, upper in [(1, -1, True), (2, 1, True), (3, 1, False), (4, -1, False)]:
    for index in range(1, 9):
        x, y, angle = arch_point(side, index)
        z = 1.33 if upper else -1.33
        # Lower teeth are slightly smaller, matching normal anatomy.
        tooth = add_tooth(f"{quadrant}{index}", (x, y, z), angle, kinds[index], upper, ivory)
        if not upper:
            tooth.scale *= 0.92

# Clinical neutral studio setup, also useful when opening the .blend file.
bpy.ops.object.camera_add(location=(8.2, -11.8, 6.7))
camera = bpy.context.object
camera.name = "BookEasy_Clinical_Camera"
camera.data.lens = 58
look_at(camera, (0, -0.35, 0))
scene.camera = camera

for name, location, energy, size in [
    ("Key", (-5.5, -6.0, 8.0), 1050, 5.0),
    ("Fill", (6.0, -2.5, 4.0), 800, 4.0),
    ("Rim", (0.0, 5.0, 7.0), 950, 3.0),
]:
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

# Only the clinical geometry is exported; camera/lights stay in the editable .blend.
for obj in bpy.context.scene.objects:
    obj.select_set(obj.type == "MESH")
bpy.context.view_layer.objects.active = bpy.data.objects.get("Gingiva_Upper")
bpy.ops.export_scene.gltf(
    filepath=GLB_PATH,
    export_format="GLB",
    use_selection=True,
    export_apply=True,
    export_extras=True,
    export_materials="EXPORT",
)

bpy.ops.render.render(write_still=True)
print(f"Created {BLEND_PATH}")
print(f"Exported {GLB_PATH}")
print(f"Rendered {PREVIEW_PATH}")

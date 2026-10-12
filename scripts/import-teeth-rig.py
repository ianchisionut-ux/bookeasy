"""Convert the user-supplied rigged mouth into BookEasy's selectable FDI model.

Run with the source .blend already open, for example:
  blender --background TeethRigged.blend --python scripts/import-teeth-rig.py
"""

import bpy
import math
import os
from mathutils import Vector


ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
BLEND_PATH = os.path.join(ROOT, "assets", "blender", "bookeasy-dental-chart.blend")
GLB_PATH = os.path.join(ROOT, "public", "models", "bookeasy-dental-chart.glb")
PREVIEW_PATH = os.path.join(ROOT, "output", "dental-model-preview.png")


def look_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def bake_rig(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    for modifier in list(obj.modifiers):
        if modifier.type == "ARMATURE":
            bpy.ops.object.modifier_apply(modifier=modifier.name)
    world = obj.matrix_world.copy()
    obj.parent = None
    obj.matrix_world = world


def separate_loose_parts(obj):
    before = set(bpy.data.objects)
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.separate(type="LOOSE")
    bpy.ops.object.mode_set(mode="OBJECT")
    pieces = [candidate for candidate in bpy.data.objects if candidate == obj or candidate not in before]
    for piece in pieces:
        world = piece.matrix_world.copy()
        piece.parent = None
        piece.matrix_world = world
        bpy.ops.object.select_all(action="DESELECT")
        piece.select_set(True)
        bpy.context.view_layer.objects.active = piece
        bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")
    return pieces


def assign_arch(jaw_name, upper):
    jaw = bpy.data.objects.get(jaw_name)
    if jaw is None or jaw.type != "MESH":
        raise RuntimeError(f"Missing mesh {jaw_name}")
    bake_rig(jaw)
    pieces = separate_loose_parts(jaw)
    gum = max(pieces, key=lambda item: len(item.data.vertices))
    gum.name = "Gingiva_Upper" if upper else "Gingiva_Lower"
    gum["interactive"] = False
    gum["anatomical_part"] = "gingiva"
    teeth = [piece for piece in pieces if piece != gum]
    if len(teeth) != 14:
        raise RuntimeError(f"Expected 14 teeth in {jaw_name}, found {len(teeth)}")

    quadrant_sides = ((1, -1), (2, 1)) if upper else ((4, -1), (3, 1))
    result = [gum]
    for quadrant, side in quadrant_sides:
        side_teeth = sorted(
            [tooth for tooth in teeth if tooth.location.x * side > 0],
            key=lambda tooth: tooth.location.y,
        )
        if len(side_teeth) != 7:
            raise RuntimeError(f"Expected 7 teeth in quadrant {quadrant}, found {len(side_teeth)}")
        for index, tooth in enumerate(side_teeth, start=1):
            code = f"{quadrant}{index}"
            tooth.name = f"Tooth_{code}"
            tooth["fdi"] = code
            tooth["interactive"] = True
            tooth["upper"] = upper
            tooth["tooth_kind"] = (
                "central" if index == 1 else "lateral" if index == 2 else
                "canine" if index == 3 else "premolar" if index <= 5 else "molar"
            )
            result.append(tooth)

        # The supplied anatomy contains the common 28-tooth adult set. Preserve
        # its design language and add a smaller, more variable third molar so the
        # clinical FDI chart remains complete at 32 teeth.
        second_molar = side_teeth[-1]
        first_molar = side_teeth[-2]
        third_molar = second_molar.copy()
        third_molar.data = second_molar.data.copy()
        bpy.context.collection.objects.link(third_molar)
        direction = second_molar.location - first_molar.location
        third_molar.location = second_molar.location + direction * 0.88
        third_molar.scale = second_molar.scale * 0.84
        code = f"{quadrant}8"
        third_molar.name = f"Tooth_{code}"
        third_molar["fdi"] = code
        third_molar["interactive"] = True
        third_molar["upper"] = upper
        third_molar["tooth_kind"] = "molar"
        result.append(third_molar)
    return result


armature = bpy.data.objects.get("Armature")
if armature and armature.pose.bones.get("LowerJaw"):
    lower_jaw_bone = armature.pose.bones["LowerJaw"]
    lower_jaw_bone.rotation_mode = "XYZ"
    lower_jaw_bone.rotation_euler.x = math.radians(24.0)
    bpy.context.view_layer.update()

model_objects = assign_arch("UpperJaw", True) + assign_arch("LowerJaw", False)

# Remove the source rig and old lighting once the visible pose is baked.
for obj in list(bpy.data.objects):
    if obj not in model_objects and obj.type in {"ARMATURE", "LIGHT", "CAMERA", "EMPTY"}:
        bpy.data.objects.remove(obj, do_unlink=True)

# Normalize the supplied model to the coordinate system already used by the
# BookEasy viewer. Parenting keeps every tooth independently selectable.
world_points = []
for obj in model_objects:
    world_points.extend(obj.matrix_world @ Vector(corner) for corner in obj.bound_box)
minimum = Vector((min(point.x for point in world_points), min(point.y for point in world_points), min(point.z for point in world_points)))
maximum = Vector((max(point.x for point in world_points), max(point.y for point in world_points), max(point.z for point in world_points)))
center = (minimum + maximum) * 0.5
scale = 2.62
root = bpy.data.objects.new("BookEasy_Dentition", None)
bpy.context.collection.objects.link(root)
root.scale = (scale, scale, scale)
root.location = (-center.x * scale, -center.y * scale - 0.15, -center.z * scale)
for obj in model_objects:
    world = obj.matrix_world.copy()
    obj.parent = root
    obj.matrix_world = world

scene = bpy.context.scene
scene.name = "BookEasy Selectable Adult Dentition"
scene["source_note"] = "User-supplied TeethRigged.blend converted into separate clinical objects"
scene.render.resolution_x = 1200
scene.render.resolution_y = 900
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.filepath = PREVIEW_PATH
scene.world.color = (0.025, 0.035, 0.04)
available_engines = [item.identifier for item in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items]
scene.render.engine = next((engine for engine in available_engines if "EEVEE" in engine), scene.render.engine)

bpy.ops.object.camera_add(location=(6.8, -11.8, 3.4))
camera = bpy.context.object
camera.name = "BookEasy_Clinical_Camera"
camera.data.lens = 58
look_at(camera, (0.0, -0.15, 0.0))
scene.camera = camera
for name, location, energy, size in (
    ("Key", (-5.5, -6.0, 7.0), 1050, 5.0),
    ("Fill", (6.0, -2.0, 4.0), 700, 4.0),
    ("Rim", (0.0, 5.0, 6.5), 820, 3.0),
):
    bpy.ops.object.light_add(type="AREA", location=location)
    light = bpy.context.object
    light.name = f"BookEasy_{name}"
    light.data.energy = energy
    light.data.shape = "DISK"
    light.data.size = size
    look_at(light, (0.0, 0.0, 0.0))

os.makedirs(os.path.dirname(BLEND_PATH), exist_ok=True)
os.makedirs(os.path.dirname(GLB_PATH), exist_ok=True)
os.makedirs(os.path.dirname(PREVIEW_PATH), exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)

bpy.ops.object.select_all(action="DESELECT")
for obj in model_objects:
    obj.select_set(True)
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

print(f"Saved separated Blender source: {BLEND_PATH}")
print(f"Exported 32-tooth clinical model: {GLB_PATH}")
print(f"Rendered preview: {PREVIEW_PATH}")

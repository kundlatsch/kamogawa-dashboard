from django.db import migrations

# Seeded classes were first created with Portuguese names; Gustavo wants the English names only.
# Only rows still carrying a seeded name are touched, so classes the coach renamed stay as they are.
RENAMES = {
    "out-boxer": ("Boxeador de Longo Alcance", "Out-Boxer", "Luta de longe, com jab, movimentação e controle da distância."),
    "swarmer": ("Enxameador", "Swarmer", "In-fighter: encurta a distância e pressiona com volume de golpes."),
    "slugger": ("Lutador", "Slugger", "Brawler: aposta na força e em golpes pesados, de curta distância."),
    "boxer-puncher": ("Boxeador-Socador", "Boxer-Puncher", "Combina técnica e potência, em média distância."),
    "counterpuncher": ("Contragolpeador", "Counterpuncher", "Espera o ataque e responde no contragolpe."),
    "switch-hitter": ("Ambidestro", "Switch-Hitter", "Troca de base e luta bem dos dois lados."),
}


def rename_to_english(apps, schema_editor):
    FighterClass = apps.get_model("gamification", "FighterClass")
    for art_key, (old_name, new_name, description) in RENAMES.items():
        for fighter_class in FighterClass.objects.filter(art_key=art_key, name=old_name):
            if FighterClass.objects.filter(gym_id=fighter_class.gym_id, name=new_name).exists():
                continue
            fighter_class.name = new_name
            fighter_class.description = description
            fighter_class.save(update_fields=["name", "description"])


class Migration(migrations.Migration):
    dependencies = [("gamification", "0003_fighter_class_image")]

    operations = [migrations.RunPython(rename_to_english, migrations.RunPython.noop)]

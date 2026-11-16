from rest_framework import serializers

from accounts.models import User
from training.serializers import NamedListSerializer

from .models import Assessment, Metric


class MetricSerializer(NamedListSerializer):
    class Meta:
        model = Metric
        fields = ["id", "name", "group", "color", "order", "archived"]


class AssessmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Assessment
        fields = ["id", "student", "metric", "period", "score", "notes", "updated_at"]


def month_start(day):
    return day.replace(day=1)


class SetAssessmentSerializer(serializers.Serializer):
    """Upsert one score; `score: null` clears it. Any day of the month selects that month."""

    student = serializers.PrimaryKeyRelatedField(queryset=User.objects.none())
    metric = serializers.PrimaryKeyRelatedField(queryset=Metric.objects.none())
    period = serializers.DateField()
    score = serializers.IntegerField(min_value=1, max_value=5, allow_null=True)
    notes = serializers.CharField(required=False, allow_blank=True, default="")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        gym = self.context["request"].user.gym
        self.fields["student"].queryset = User.objects.filter(gym=gym, role=User.Role.STUDENT)
        self.fields["metric"].queryset = Metric.objects.filter(gym=gym)

    def validate_period(self, value):
        return month_start(value)

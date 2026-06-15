<?xml version="1.0" encoding="utf-8"?>
<serviceSpecificationDelta version="1.0" source="Comparison between old service XML and completed integral CdC XML" status="delta-generated">
  <service id="content-catalog-service" oldFile="content-catalog-service.xml.old" newFile="content-catalog-service.xml"/>
  <basis>
    <oldSource>Existing XML from simplified CdC folder, saved as .old.</oldSource>
    <newSource>G:\Mon Drive\Visio-Science\Informatique\vma\Cahier des Charges VisioMath - V 1.1.1 - 240531.docx</newSource>
    <sourceReferences>CDC lines 84-88, 159-162, 207-223, 472-524, 565-566, 619-621</sourceReferences>
  </basis>
  <changedRequirements>
    <item>Transforme le catalogue en systeme complet exercices/evaluations/tutos avec reponses, corrections et couts.</item>
    <item>Ajoute validation, points, recherche, tags, liens copiables et activites non pourvues.</item>
    <item>Precise le demarrage restreint aux formateurs pour le chargement.</item>
  </changedRequirements>
  <addedRequirements>
    <item>Evaluation chronometree et blocage retour.</item>
    <item>Solution officielle moins chere validee.</item>
    <item>Commentaires avec regles anti-solution.</item>
  </addedRequirements>
  <openRisks>
    <item>Les couts et recompenses doivent rester parametrables par AF, pas hardcodes.</item>
  </openRisks>
  <implementationAttention>
    <item>Ce delta n'est pas un patch de code; il expose les ecarts de specification a prendre en compte avant implementation.</item>
    <item>Les routes candidateApis sont indicatives et doivent etre alignees avec les conventions backend existantes avant codage.</item>
  </implementationAttention>
</serviceSpecificationDelta>
